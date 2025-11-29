/**
 * TikTok OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from TikTok after user authorization.
 * Exchanges the authorization code for access tokens and stores credentials.
 *
 * OAuth Flow:
 * 1. User clicks "Connect TikTok" -> redirected to TikTok authorization
 * 2. User authorizes app -> TikTok redirects here with authorization code
 * 3. This handler exchanges code for tokens
 * 4. Tokens are encrypted and stored in database
 * 5. User redirected to success page
 *
 * Required Environment Variables:
 * - TIKTOK_CLIENT_KEY
 * - TIKTOK_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 * - SUPABASE_ENCRYPTION_SECRET
 *
 * TikTok API Documentation:
 * https://developers.tiktok.com/doc/login-kit-web
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { TikTokOAuthHelper } from '@/lib/scheduler/platforms/tiktok';

// TikTok API constants
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name: string;
  follower_count?: number;
  profile_deep_link?: string;
}

/**
 * GET handler for TikTok OAuth callback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from TikTok
  if (error) {
    console.error('TikTok OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
        errorDescription || error
      )}`
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
        'Missing authorization code'
      )}`
    );
  }

  // SECURITY: Validate CSRF state parameter - cookie state is ALWAYS required
  const cookieStore = await cookies();
  const storedState = cookieStore.get('tiktok_oauth_state')?.value;

  // Cookie-based state validation is mandatory for CSRF protection
  if (!storedState || !state || state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
        'Invalid state parameter - possible CSRF attack'
      )}`
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
        `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
          'OAuth state expired - please try again'
        )}`
      );
    }
  }

  try {
    const redirectUri = `${baseUrl}/auth/callback/tiktok`;

    // Exchange authorization code for access token
    const tokenData = await TikTokOAuthHelper.exchangeCodeForToken(code, redirectUri);

    // Fetch user profile information
    const userInfo = await fetchUserInfo(tokenData.access_token);

    // SECURITY: Always get user from authenticated session - never trust URL state for user identity
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('User not authenticated');
    }
    const userId = user.id;

    // Calculate token expiration
    // TikTok access tokens expire in ~24 hours by default
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);
    const refreshExpiresAt = new Date(
      Date.now() + (tokenData.refresh_expires_in || 365 * 24 * 60 * 60) * 1000
    );

    // Encrypt tokens before storage
    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('SUPABASE_ENCRYPTION_SECRET not configured');
    }

    // Encrypt access token
    const { data: encryptedAccessToken, error: encryptAccessError } = await supabase.rpc(
      'encrypt_token',
      { token: tokenData.access_token, secret: encryptionSecret }
    );

    if (encryptAccessError) {
      console.error('Failed to encrypt access token:', encryptAccessError);
      throw new Error('Failed to encrypt access token');
    }

    // Encrypt refresh token
    let encryptedRefreshToken = null;
    if (tokenData.refresh_token) {
      const { data: encryptedRefresh, error: encryptRefreshError } = await supabase.rpc(
        'encrypt_token',
        { token: tokenData.refresh_token, secret: encryptionSecret }
      );

      if (encryptRefreshError) {
        console.error('Failed to encrypt refresh token:', encryptRefreshError);
        throw new Error('Failed to encrypt refresh token');
      }
      encryptedRefreshToken = encryptedRefresh;
    }

    // Store or update social account in database
    const { error: upsertError } = await supabase.from('social_accounts').upsert(
      {
        user_id: userId,
        platform: 'tiktok',
        account_id: userInfo.open_id,
        account_name: userInfo.display_name,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt.toISOString(),
        scopes: tokenData.scope?.split(',') || ['user.info.basic', 'video.upload', 'video.publish'],
        is_active: true,
        metadata: {
          union_id: userInfo.union_id,
          avatar_url: userInfo.avatar_url,
          follower_count: userInfo.follower_count,
          profile_url: userInfo.profile_deep_link,
          refresh_token_expires_at: refreshExpiresAt.toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform,account_id',
      }
    );

    if (upsertError) {
      console.error('Failed to store TikTok credentials:', upsertError);
      throw new Error('Failed to save TikTok account');
    }

    // Clear the OAuth state cookie
    const response = NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?success=tiktok&account=${encodeURIComponent(
        userInfo.display_name
      )}`
    );

    response.cookies.delete('tiktok_oauth_state');

    return response;
  } catch (err) {
    console.error('TikTok OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(message)}`
    );
  }
}

/**
 * Fetch TikTok user profile information
 */
async function fetchUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const fields = 'open_id,union_id,avatar_url,display_name,follower_count,profile_deep_link';

  const response = await fetch(
    `${TIKTOK_API_BASE}/user/info/?fields=${encodeURIComponent(fields)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('TikTok user info fetch failed:', errorText);
    throw new Error('Failed to fetch TikTok user profile');
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`TikTok API error: ${data.error.message}`);
  }

  const user = data.data?.user;
  if (!user) {
    throw new Error('No user data returned from TikTok');
  }

  return {
    open_id: user.open_id,
    union_id: user.union_id,
    avatar_url: user.avatar_url,
    display_name: user.display_name,
    follower_count: user.follower_count,
    profile_deep_link: user.profile_deep_link,
  };
}
