/**
 * Stripe Webhook Handler
 * Receives and processes Stripe webhook events
 * IMPORTANT: This route must have raw body access for signature verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe/client';
import { processWebhookEvent } from '@/lib/stripe/webhook-handlers';

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: `Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  console.log(`Received webhook event: ${event.type} (${event.id})`);

  try {
    // Process the event with idempotency
    const success = await processWebhookEvent(event.id, event.type, event.data);

    if (success) {
      return NextResponse.json({ received: true });
    } else {
      // Return 500 to trigger Stripe retry
      return NextResponse.json({ error: 'Event processing failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: `Processing Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
