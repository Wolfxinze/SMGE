/**
 * Change Subscription Plan API
 * Upgrades or downgrades subscription to a new plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { changeSubscriptionPlan } from '@/lib/stripe/subscription';
import type { PlanId } from '@/types/subscription';

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
    const body = await request.json();
    const { planId } = body as { planId: PlanId };

    if (!planId) {
      return NextResponse.json({ error: 'Missing planId' }, { status: 400 });
    }

    // Change plan
    await changeSubscriptionPlan(user.id, planId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to change subscription plan',
      },
      { status: 500 }
    );
  }
}
