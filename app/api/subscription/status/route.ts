/**
 * Subscription Status API
 * Returns current subscription status and usage for authenticated user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveSubscription, getCurrentUsage } from '@/lib/stripe/subscription';
import type { SubscriptionStatusResponse } from '@/types/subscription';

export async function GET() {
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

    // Get subscription and usage
    const subscription = await getActiveSubscription(user.id);
    const usage = await getCurrentUsage(user.id);

    // Calculate days until renewal
    let daysUntilRenewal: number | null = null;
    if (subscription?.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      const now = new Date();
      daysUntilRenewal = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const response: SubscriptionStatusResponse = {
      subscription,
      usage,
      is_active: subscription?.status === 'active' || subscription?.status === 'trialing',
      days_until_renewal: daysUntilRenewal,
      cancel_at_period_end: subscription?.cancel_at_period_end || false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
