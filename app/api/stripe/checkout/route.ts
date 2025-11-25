/**
 * Stripe Checkout Session API
 * Creates a Stripe checkout session for subscription signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/subscription';
import type { CreateCheckoutSessionRequest } from '@/types/subscription';

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
    const body = (await request.json()) as CreateCheckoutSessionRequest;
    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
    }

    // Map price ID to plan ID
    const planIdMap: Record<string, string> = {
      [process.env.STRIPE_PRICE_ID_STARTER || '']: 'starter',
      [process.env.STRIPE_PRICE_ID_GROWTH || '']: 'growth',
      [process.env.STRIPE_PRICE_ID_AGENCY || '']: 'agency',
    };

    const planId = planIdMap[priceId];
    if (!planId) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
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
      planId as any,
      successUrl || `${baseUrl}/dashboard/billing?success=true`,
      cancelUrl || `${baseUrl}/dashboard/billing?canceled=true`
    );

    return NextResponse.json({
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
