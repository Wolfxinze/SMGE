/**
 * Resume Subscription API
 * Resumes a canceled subscription
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resumeSubscription } from '@/lib/stripe/subscription';

export async function POST() {
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

    // Resume subscription
    await resumeSubscription(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to resume subscription',
      },
      { status: 500 }
    );
  }
}
