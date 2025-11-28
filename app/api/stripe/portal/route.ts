/**
 * Stripe Customer Portal API
 * Creates a portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPortalSession } from '@/lib/stripe/subscription';

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

    // Get return URL from request or use default
    const body = await request.json();
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const returnUrl = body.returnUrl || `${baseUrl}/dashboard/billing`;

    // Create portal session
    const session = await createPortalSession(user.id, returnUrl);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create portal session',
      },
      { status: 500 }
    );
  }
}
