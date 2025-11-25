/**
 * Rate Limiting Utility
 *
 * Database-based rate limiting to prevent API abuse and control costs.
 * Uses Supabase to track request counts per user per time window.
 */

import { createClient } from '@/lib/supabase/server';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

/**
 * Check if user has exceeded rate limit for given endpoint
 *
 * @param userId - User ID to check
 * @param endpoint - API endpoint identifier
 * @param limit - Maximum requests allowed per window
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const supabase = await createClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Count requests in current window
    const { count, error: countError } = await supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('Rate limit check error:', countError);
      // Fail open: allow request if we can't check rate limit
      return {
        success: true,
        limit,
        remaining: limit,
        reset: new Date(now.getTime() + windowMs),
      };
    }

    const requestCount = count || 0;
    const remaining = Math.max(0, limit - requestCount - 1);
    const reset = new Date(now.getTime() + windowMs);

    // Check if limit exceeded
    if (requestCount >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset,
      };
    }

    // Record this request
    const { error: insertError } = await (supabase
      .from('api_rate_limits') as any)
      .insert({
        user_id: userId,
        endpoint,
        created_at: now.toISOString(),
      });

    if (insertError) {
      console.error('Failed to record rate limit:', insertError);
      // Still allow request even if recording fails
    }

    return {
      success: true,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open: allow request on error
    return {
      success: true,
      limit,
      remaining: limit,
      reset: new Date(now.getTime() + windowMs),
    };
  }
}

/**
 * Clean up old rate limit records (should be run periodically)
 *
 * @param olderThanMs - Delete records older than this (default: 1 hour)
 */
export async function cleanupRateLimits(olderThanMs: number = 3600000): Promise<void> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - olderThanMs);

  try {
    await supabase
      .from('api_rate_limits')
      .delete()
      .lt('created_at', cutoff.toISOString());
  } catch (error) {
    console.error('Failed to cleanup rate limits:', error);
  }
}
