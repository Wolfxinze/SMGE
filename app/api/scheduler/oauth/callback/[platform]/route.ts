/**
 * Social Platform OAuth Callback
 * GET /api/scheduler/oauth/callback/:platform
 *
 * Handles OAuth callback from social platforms and stores credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformOAuthManager, PlatformFactory } from '@/lib/scheduler/platforms/base';
import type { SocialPlatform } from '@/lib/scheduler/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformParam } = await params;
    const platform = platformParam as SocialPlatform;
    const searchParams = request.nextUrl.searchParams;

    // Get OAuth parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/profile/social-accounts?error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/profile/social-accounts?error=invalid_callback',
          request.url
        )
      );
    }

    // Decode and validate state
    let stateData: { user_id: string; brand_id: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL(
          '/profile/social-accounts?error=invalid_state',
          request.url
        )
      );
    }

    // Validate state timestamp (prevent replay attacks)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) { // 10 minutes
      return NextResponse.redirect(
        new URL(
          '/profile/social-accounts?error=state_expired',
          request.url
        )
      );
    }

    // Exchange code for tokens
    const credentials = await PlatformOAuthManager.exchangeCodeForToken(
      platform,
      code
    );

    // Get account info from platform
    const platformInstance = await PlatformFactory.getPlatform(platform, credentials);
    const accountInfo = await platformInstance.getAccountInfo();

    // Store credentials in database
    const supabase = await createClient();

    // Get encryption secret from environment
    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('SUPABASE_ENCRYPTION_SECRET not configured');
    }

    // Encrypt tokens
    const { data: encryptedAccessToken } = await supabase.rpc('encrypt_token', {
      token: credentials.access_token,
      secret: encryptionSecret,
    });

    let encryptedRefreshToken = null;
    if (credentials.refresh_token) {
      const { data } = await supabase.rpc('encrypt_token', {
        token: credentials.refresh_token,
        secret: encryptionSecret,
      });
      encryptedRefreshToken = data;
    }

    // Upsert social account
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: stateData.user_id,
        platform,
        account_name: accountInfo.account_name,
        account_id: accountInfo.account_id,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: credentials.expires_at?.toISOString(),
        scopes: credentials.scopes || [],
        is_active: true,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform,account_id',
      });

    if (dbError) {
      console.error('Database error storing social account:', dbError);
      throw dbError;
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/profile/social-accounts?success=${platform}&account=${accountInfo.account_name}`,
        request.url
      )
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        '/profile/social-accounts?error=oauth_failed',
        request.url
      )
    );
  }
}
