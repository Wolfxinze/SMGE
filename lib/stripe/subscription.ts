/**
 * Subscription Management Utilities
 * Business logic for subscription operations
 */

import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICE_IDS } from './client';
import type {
  PlanId,
  SubscriptionWithPlan,
  UsageMetrics,
  UsageCheckResult,
  UsageAction,
} from '@/types/subscription';

/**
 * Get or create Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const supabase = await createClient();

  // Check if user already has a Stripe customer ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single() as any;

  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // Save customer_id to database to prevent orphaned customers
  const { error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_customer_id: customer.id,
      status: 'incomplete',
      plan_id: 'free', // Default to free plan
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 100 years for free tier
    });

  if (error) {
    console.error('Failed to save customer_id to database:', error);
    // Still return the customer ID but log the error for manual intervention
  }

  return customer.id;
}

/**
 * Get active subscription for a user
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionWithPlan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      `
      *,
      plan:subscription_plans!subscriptions_plan_id_fkey(*)
    `
    )
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as SubscriptionWithPlan;
}

/**
 * Get current usage metrics for a user
 */
export async function getCurrentUsage(userId: string): Promise<UsageMetrics | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('user_id', userId)
    .lte('period_start', new Date().toISOString())
    .gte('period_end', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data as UsageMetrics;
}

/**
 * Check if user can perform an action based on their subscription limits
 */
export async function checkUsageLimit(
  userId: string,
  action: UsageAction
): Promise<UsageCheckResult> {
  const supabase = await createClient();

  // Call the database function
  // @ts-ignore - RPC function types not properly inferred
  const { data, error } = await supabase.rpc('check_usage_allowed', {
    p_user_id: userId,
    p_action: action,
  });

  // @ts-ignore - Type inference issue
  if (error || !data || data.length === 0) {
    console.error('Error checking usage limit:', error);
    return {
      allowed: false,
      current_usage: 0,
      limit: 0,
      percentage_used: 100,
      message: 'Failed to check usage limit',
    };
  }

  // @ts-ignore - Type inference issue
  const result = data[0];

  // If we have the result from the database function, use it directly
  if (result) {
    return {
      // @ts-ignore - Type inference issue
      allowed: result.allowed,
      // @ts-ignore - Type inference issue
      current_usage: result.current_usage,
      // @ts-ignore - Type inference issue
      limit: result.limit,
      // @ts-ignore - Type inference issue
      percentage_used: result.percentage_used,
      // @ts-ignore - Type inference issue
      message: result.message || undefined,
    };
  }

  // Fallback to manual calculation if needed
  const subscription = await getActiveSubscription(userId);
  const usage = await getCurrentUsage(userId);

  if (!subscription || !usage) {
    return {
      allowed: false,
      current_usage: 0,
      limit: 0,
      percentage_used: 0,
      message: 'No active subscription',
    };
  }

  // Map action to usage field and limit
  let currentUsage = 0;
  let limit = 0;

  switch (action) {
    case 'create_post':
      currentUsage = usage.posts_created;
      limit = subscription.plan.limits.posts_per_month;
      break;
    case 'create_brand':
      currentUsage = usage.brands_created;
      limit = subscription.plan.limits.brands;
      break;
    case 'connect_social_account':
      currentUsage = usage.social_accounts_connected;
      limit = subscription.plan.limits.social_accounts_per_brand;
      break;
    case 'use_ai_credits':
      currentUsage = usage.ai_credits_consumed;
      limit = subscription.plan.limits.ai_credits_per_month;
      break;
  }

  const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 0;

  return {
    allowed: data as boolean,
    current_usage: currentUsage,
    limit,
    percentage_used: percentageUsed,
    message: data ? undefined : `You have reached your ${action.replace('_', ' ')} limit`,
  };
}

/**
 * Increment usage counter for a specific metric
 */
export async function incrementUsage(
  userId: string,
  metric: string,
  amount: number = 1
): Promise<boolean> {
  const supabase = await createClient();

  // @ts-ignore - RPC function types not properly inferred
  const { error } = await supabase.rpc('update_usage_metric', {
    p_user_id: userId,
    p_metric: metric,
    p_amount: amount,
  });

  if (error) {
    console.error('Error incrementing usage:', error);
    return false;
  }

  return true;
}

/**
 * Create a checkout session for subscription
 *
 * @param userId - The user's ID
 * @param email - The user's email
 * @param planId - The plan ID (e.g., 'starter', 'professional')
 * @param successUrl - URL to redirect to on success
 * @param cancelUrl - URL to redirect to on cancellation
 * @param priceIdOverride - Optional: Use a specific Stripe Price ID instead of looking up from plan
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string,
  priceIdOverride?: string
): Promise<{ sessionId: string; url: string | null }> {
  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(userId, email);

  // Get price ID - use override if provided, otherwise look up from plan
  let priceId: string;

  if (priceIdOverride) {
    priceId = priceIdOverride;
  } else {
    // Legacy lookup from STRIPE_PRICE_IDS
    const lookupPriceId = STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS];
    if (!lookupPriceId) {
      throw new Error(`Invalid plan: ${planId}`);
    }
    priceId = lookupPriceId;
  }

  // Validate the price ID before using it
  if (!priceId || priceId.includes('PLACEHOLDER') || !priceId.startsWith('price_')) {
    throw new Error(
      `Stripe Price ID not configured for plan: ${planId}. ` +
        'Please configure the appropriate STRIPE_PRICE_* environment variable.'
    );
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Create a customer portal session
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const subscription = await getActiveSubscription(userId);

  if (!subscription?.stripe_customer_id) {
    throw new Error('No active subscription found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: returnUrl,
  });

  return {
    url: session.url,
  };
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(userId: string): Promise<boolean> {
  const subscription = await getActiveSubscription(userId);

  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('subscriptions')
    // @ts-ignore - Database type inference issue
    .update({ cancel_at_period_end: true })
    .eq('id', subscription.id);

  if (error) {
    console.error('Failed to update subscription in database:', error);
    // Consider: Should we rollback the Stripe change? Log for manual intervention
    throw new Error('Database sync failed: ' + error.message);
  }

  return true;
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(userId: string): Promise<boolean> {
  const subscription = await getActiveSubscription(userId);

  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  // Update in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('subscriptions')
    // @ts-ignore - Database type inference issue
    .update({ cancel_at_period_end: false })
    .eq('id', subscription.id);

  if (error) {
    console.error('Failed to update subscription in database:', error);
    // Consider: Should we rollback the Stripe change? Log for manual intervention
    throw new Error('Database sync failed: ' + error.message);
  }

  return true;
}

/**
 * Upgrade/downgrade subscription to a new plan
 */
export async function changeSubscriptionPlan(
  userId: string,
  newPlanId: PlanId
): Promise<boolean> {
  const subscription = await getActiveSubscription(userId);

  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  // Get new price ID
  const newPriceId = STRIPE_PRICE_IDS[newPlanId as keyof typeof STRIPE_PRICE_IDS];
  if (!newPriceId) {
    throw new Error(`Invalid plan: ${newPlanId}`);
  }

  // Get current subscription from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripe_subscription_id
  );

  // Update subscription with new price
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'always_invoice',
  });

  // Update plan in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_id: newPlanId,
      stripe_price_id: newPriceId
    })
    .eq('id', subscription.id);

  if (error) {
    console.error('Failed to update subscription plan in database:', error);
    // Consider: Should we rollback the Stripe change? Log for manual intervention
    throw new Error('Database sync failed: ' + error.message);
  }

  return true;
}
