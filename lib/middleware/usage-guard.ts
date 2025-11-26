/**
 * Usage Limit Enforcement Middleware
 * Checks subscription limits before allowing actions
 */

import { createClient } from '@/lib/supabase/server';
import { checkUsageLimit } from '@/lib/stripe/subscription';
import type { UsageAction, UsageCheckResult } from '@/types/subscription';

/**
 * Usage guard error class
 */
export class UsageLimitError extends Error {
  constructor(
    message: string,
    public readonly usageCheck: UsageCheckResult
  ) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

/**
 * Check if user can perform an action based on their subscription limits
 * Throws UsageLimitError if limit exceeded
 */
export async function enforceUsageLimit(
  userId: string,
  action: UsageAction
): Promise<UsageCheckResult> {
  const result = await checkUsageLimit(userId, action);

  if (!result.allowed) {
    throw new UsageLimitError(
      result.message || `You have reached your ${action.replace('_', ' ')} limit`,
      result
    );
  }

  return result;
}

/**
 * Middleware wrapper for API routes
 * Usage: const result = await withUsageGuard(userId, 'create_post', async () => { ... });
 */
export async function withUsageGuard<T>(
  userId: string,
  action: UsageAction,
  handler: () => Promise<T>
): Promise<T> {
  // Check usage limit first
  await enforceUsageLimit(userId, action);

  // Execute handler
  return handler();
}

/**
 * Check multiple usage limits at once
 */
export async function checkMultipleUsageLimits(
  userId: string,
  actions: UsageAction[]
): Promise<Record<UsageAction, UsageCheckResult>> {
  const results = await Promise.all(
    actions.map(async (action) => ({
      action,
      result: await checkUsageLimit(userId, action),
    }))
  );

  return results.reduce(
    (acc, { action, result }) => {
      acc[action] = result;
      return acc;
    },
    {} as Record<UsageAction, UsageCheckResult>
  );
}

/**
 * Get usage warnings (80% threshold)
 */
export async function getUsageWarnings(userId: string): Promise<string[]> {
  const actions: UsageAction[] = [
    'create_post',
    'create_brand',
    'connect_social_account',
    'use_ai_credits',
  ];

  const results = await checkMultipleUsageLimits(userId, actions);
  const warnings: string[] = [];

  for (const [action, result] of Object.entries(results)) {
    if (result.percentage_used >= 80 && result.percentage_used < 100) {
      warnings.push(
        `You have used ${result.percentage_used.toFixed(0)}% of your ${action.replace('_', ' ')} limit (${result.current_usage}/${result.limit})`
      );
    }
  }

  return warnings;
}

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const supabase = await createClient();

  // Get active subscription with plan limits
  // @ts-ignore - RPC function types not properly inferred
  const { data } = await supabase.rpc('get_subscription_limits', {
    p_user_id: userId,
  });

  // @ts-ignore - Type inference issue
  if (!data || data.length === 0) {
    // Check free tier
    const { data: freePlan } = await (supabase
      .from('subscription_plans')
      .select('limits')
      .eq('plan_id', 'free')
      .single() as any);

    if (!freePlan) return false;

    const features = (freePlan.limits as any).features || [];
    return features.includes(feature);
  }

  // @ts-ignore - Type inference issue
  const subscription = data[0];
  // @ts-ignore - Type inference issue
  const features = (subscription.limits as any).features || [];
  return features.includes(feature);
}
