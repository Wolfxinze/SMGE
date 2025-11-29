/**
 * Instagram OAuth Callback Route
 * GET /auth/callback/instagram
 *
 * Handles Instagram OAuth callback via Facebook's OAuth system.
 *
 * SECURITY:
 * - Cookie-based CSRF validation (mandatory)
 * - User ID always from authenticated session (never from URL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { InstagramOAuthHelper } from '@/lib/scheduler/platforms/instagram';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (error) {
    console.error('Instagram OAuth error:', { error, description: errorDescription });
    return NextResponse.redirect(
      new URL(`/profile/social-accounts?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/profile/social-accounts?error=invalid_callback', requestUrl.origin)
    );
  }

  // SECURITY: Validate CSRF state parameter - cookie state is ALWAYS required
  const cookieStore = await cookies();
  const storedState = cookieStore.get('instagram_oauth_state')?.value;

  // Cookie-based state validation is mandatory for CSRF protection
  if (!storedState || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL('/profile/social-accounts?error=invalid_state', requestUrl.origin)
    );
  }

  // Only after CSRF validation passes, try to extract additional metadata from state
  // NOTE: This metadata is only used for non-security-critical purposes like brand_id
  let stateData: { brand_id?: string; timestamp?: number } | null = null;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    // State was valid for CSRF but not JSON-encoded - that's fine
  }

  // Validate state timestamp if present (optional expiry check)
  if (stateData?.timestamp) {
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) { // 10 minute expiry
      return NextResponse.redirect(
        new URL('/profile/social-accounts?error=state_expired', requestUrl.origin)
      );
    }
  }

  try {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/auth/callback/instagram`;

    // Exchange code for short-lived token
    const shortLivedTokenData = await InstagramOAuthHelper.exchangeCodeForToken(
      code, appId, appSecret, redirectUri
    );

    // Exchange for long-lived token (60 days)
    const longLivedTokenData = await InstagramOAuthHelper.getLongLivedToken(
      shortLivedTokenData.access_token, appId, appSecret
    );

    // Get Instagram Business accounts
    const instagramAccounts = await InstagramOAuthHelper.getInstagramBusinessAccounts(
      longLivedTokenData.access_token
    );

    if (instagramAccounts.length === 0) {
      return NextResponse.redirect(
        new URL('/profile/social-accounts?error=' +
          encodeURIComponent('No Instagram Business accounts found. Connect an Instagram Business or Creator account to a Facebook Page first.'),
          requestUrl.origin
        )
      );
    }

    const selectedAccount = instagramAccounts[0];

    // Get Page access token for publishing
    const pageAccessToken = await InstagramOAuthHelper.getPageAccessToken(
      longLivedTokenData.access_token, selectedAccount.page_id
    );

    // Exchange Page token for long-lived token
    const longLivedPageToken = await getLongLivedPageToken(pageAccessToken, appId, appSecret);

    const expiresAt = new Date(Date.now() + (longLivedTokenData.expires_in || 5184000) * 1000);

    // SECURITY: Always get user from authenticated session - never trust URL state for user identity
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;

    if (!encryptionSecret) throw new Error('SUPABASE_ENCRYPTION_SECRET not configured');

    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc(
      'encrypt_token', { token: longLivedPageToken, secret: encryptionSecret }
    );

    if (encryptError) throw new Error('Failed to encrypt access token');

    const { error: dbError } = await supabase.from('social_accounts').upsert(
      {
        user_id: user.id,
        platform: 'instagram',
        account_name: selectedAccount.username,
        account_id: selectedAccount.id,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: null,
        token_expires_at: expiresAt.toISOString(),
        scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights'],
        is_active: true,
        last_synced_at: new Date().toISOString(),
        metadata: {
          page_id: selectedAccount.page_id,
          page_name: selectedAccount.page_name,
          profile_picture_url: selectedAccount.profile_picture_url,
          followers_count: selectedAccount.followers_count,
        },
      },
      { onConflict: 'user_id,platform,account_id' }
    );

    if (dbError) throw dbError;

    // Clear the OAuth state cookie and redirect to success
    const response = NextResponse.redirect(
      new URL(`/profile/social-accounts?success=instagram&account=${encodeURIComponent(selectedAccount.username)}`, requestUrl.origin)
    );
    response.cookies.delete('instagram_oauth_state');

    return response;
  } catch (error) {
    console.error('Instagram OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect Instagram account';
    return NextResponse.redirect(
      new URL(`/profile/social-accounts?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    );
  }
}

async function getLongLivedPageToken(pageAccessToken: string, appId: string, appSecret: string): Promise<string> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: pageAccessToken,
      })
    );

    if (response.ok) {
      const data = await response.json();
      return data.access_token;
    }
    return pageAccessToken;
  } catch {
    return pageAccessToken;
  }
}
