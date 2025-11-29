/**
 * Stripe Checkout Session API
 * Creates a Stripe checkout session for subscription signup
 *
 * Supports two request formats:
 * 1. Legacy: { priceId: "price_xxx" } - Direct Stripe Price ID
 * 2. New: { planId: "starter", billingPeriod: "monthly" } - Plan-based selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/subscription';
import {
  isValidPriceId,
  getPlanByPriceId,
  PLAN_CONFIG,
  type PaidPlanId,
  type BillingPeriod,
} from '@/lib/stripe/client';
import type { CreateCheckoutSessionRequest } from '@/types/subscription';

/**
 * Extended request body to support billing period selection
 */
interface CheckoutRequestBody extends CreateCheckoutSessionRequest {
  planId?: PaidPlanId;
  billingPeriod?: BillingPeriod;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = (await request.json()) as CheckoutRequestBody;
    const { priceId, planId: requestedPlanId, billingPeriod, successUrl, cancelUrl } = body;

    // Determine the plan ID and price ID to use
    let resolvedPlanId: PaidPlanId | null = null;
    let resolvedPriceId: string | null = null;

    // Option 1: Direct priceId provided (legacy support)
    if (priceId) {
      // Validate the provided price ID
      if (!isValidPriceId(priceId)) {
        return NextResponse.json(
          {
            error: 'Invalid or unconfigured price ID',
            message: 'The provided Stripe Price ID is not valid or has not been configured.',
          },
          { status: 400 }
        );
      }

      // Look up plan from price ID
      const planLookup = getPlanByPriceId(priceId);
      if (!planLookup) {
        return NextResponse.json(
          {
            error: 'Unknown price ID',
            message: 'The provided Price ID does not match any configured plan.',
          },
          { status: 400 }
        );
      }

      resolvedPlanId = planLookup.plan.id as PaidPlanId;
      resolvedPriceId = priceId;
    }
    // Option 2: planId and billingPeriod provided (new preferred method)
    else if (requestedPlanId && billingPeriod) {
      const plan = PLAN_CONFIG[requestedPlanId];
      if (!plan) {
        return NextResponse.json(
          {
            error: 'Invalid plan',
            message: `Plan "${requestedPlanId}" does not exist.`,
          },
          { status: 400 }
        );
      }

      // Get the appropriate price ID based on billing period
      const targetPriceId = billingPeriod === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;

      // Validate the price ID is configured
      if (!isValidPriceId(targetPriceId)) {
        return NextResponse.json(
          {
            error: 'Plan not configured',
            message: `The ${requestedPlanId} plan with ${billingPeriod} billing is not yet configured. Please contact support.`,
            details: {
              planId: requestedPlanId,
              billingPeriod,
              configured: false,
            },
          },
          { status: 503 }
        );
      }

      resolvedPlanId = requestedPlanId;
      resolvedPriceId = targetPriceId;
    }
    // Neither option provided
    else {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'Provide either "priceId" or both "planId" and "billingPeriod".',
        },
        { status: 400 }
      );
    }

    // Get user email
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Create checkout session
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const session = await createCheckoutSession(
      user.id,
      email,
      resolvedPlanId,
      successUrl || `${baseUrl}/dashboard/billing?success=true`,
      cancelUrl || `${baseUrl}/dashboard/billing?canceled=true`,
      resolvedPriceId
    );

    return NextResponse.json({
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        return NextResponse.json(
          {
            error: 'Configuration error',
            message: error.message,
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
