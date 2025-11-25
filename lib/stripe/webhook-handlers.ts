/**
 * Stripe Webhook Event Handlers
 * Processes Stripe webhook events and syncs to database
 */

import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for webhook processing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Handle checkout.session.completed event
 * Creates subscription record when checkout completes
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planId) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Get full subscription details from Stripe
  const stripe = (await import('./client')).stripe;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create subscription record
  await supabaseAdmin.from('subscriptions').insert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: subscription.items.data[0].price.id,
    plan_id: planId,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    metadata: subscription.metadata || {},
  });

  console.log(`Subscription created for user ${userId}: ${subscriptionId}`);
}

/**
 * Handle customer.subscription.created event
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId || !planId) {
    console.error('Missing metadata in subscription:', subscription.id);
    return;
  }

  // Upsert subscription (may already exist from checkout.session.completed)
  await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0].price.id,
        plan_id: planId,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        metadata: subscription.metadata || {},
      },
      {
        onConflict: 'stripe_subscription_id',
      }
    );

  console.log(`Subscription upserted for user ${userId}: ${subscription.id}`);
}

/**
 * Handle customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    // Try to find user by subscription ID
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (!existingSubscription) {
      console.error('Cannot find user for subscription:', subscription.id);
      return;
    }
  }

  // Update subscription record
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: subscription.status,
      stripe_price_id: subscription.items.data[0].price.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      metadata: subscription.metadata || {},
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`Subscription updated: ${subscription.id}`);
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  // Mark subscription as canceled
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`Subscription deleted: ${subscription.id}`);
}

/**
 * Handle invoice.payment_succeeded event
 */
export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  // Get user from subscription
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Cannot find subscription for invoice:', invoice.id);
    return;
  }

  // Create or update invoice record
  await supabaseAdmin.from('invoices').upsert(
    {
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status as any,
      period_start: new Date(invoice.period_start * 1000).toISOString(),
      period_end: new Date(invoice.period_end * 1000).toISOString(),
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      payment_intent_id: invoice.payment_intent as string,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : null,
      metadata: invoice.metadata || {},
    },
    {
      onConflict: 'stripe_invoice_id',
    }
  );

  console.log(`Invoice payment succeeded: ${invoice.id}`);
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  // Get user from subscription
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Cannot find subscription for invoice:', invoice.id);
    return;
  }

  // Update invoice with failure details
  await supabaseAdmin.from('invoices').upsert(
    {
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status as any,
      period_start: new Date(invoice.period_start * 1000).toISOString(),
      period_end: new Date(invoice.period_end * 1000).toISOString(),
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      payment_intent_id: invoice.payment_intent as string,
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : null,
      last_finalization_error: invoice.last_finalization_error || {},
      metadata: invoice.metadata || {},
    },
    {
      onConflict: 'stripe_invoice_id',
    }
  );

  // TODO: Send email notification to user about payment failure
  console.error(`Invoice payment failed for user ${subscription.user_id}: ${invoice.id}`);
}

/**
 * Process webhook event with idempotency check
 */
export async function processWebhookEvent(
  eventId: string,
  eventType: string,
  eventData: any
): Promise<boolean> {
  // Check if event already processed (idempotency)
  const { data: existingEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('processed')
    .eq('stripe_event_id', eventId)
    .single();

  if (existingEvent?.processed) {
    console.log(`Event ${eventId} already processed, skipping`);
    return true;
  }

  try {
    // Record webhook event
    await supabaseAdmin.from('webhook_events').upsert(
      {
        stripe_event_id: eventId,
        event_type: eventType,
        event_data: eventData,
        processed: false,
        processing_attempts: 1,
      },
      {
        onConflict: 'stripe_event_id',
      }
    );

    // Process event based on type
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(eventData.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(eventData.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(eventData.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(eventData.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(eventData.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(eventData.object);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Mark as processed
    await supabaseAdmin
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', eventId);

    return true;
  } catch (error) {
    console.error(`Error processing webhook event ${eventId}:`, error);

    // Record error
    await supabaseAdmin
      .from('webhook_events')
      .update({
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
      })
      .eq('stripe_event_id', eventId);

    return false;
  }
}
