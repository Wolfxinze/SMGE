/**
 * LinkedIn OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from LinkedIn after user authorization.
 * Exchanges the authorization code for access tokens and stores credentials.
 *
 * OAuth Flow:
 * 1. User clicks "Connect LinkedIn" -> redirected to LinkedIn authorization
 * 2. User authorizes app -> LinkedIn redirects here with authorization code
 * 3. This handler exchanges code for tokens
 * 4. Tokens are stored in database (encrypted)
 * 5. User redirected to success page
 *
 * Required Environment Variables:
 * - LINKEDIN_CLIENT_ID
 * - LINKEDIN_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

interface LinkedInUserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * GET handler for LinkedIn OAuth callback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from LinkedIn
  if (error) {
    console.error('LinkedIn OAuth error:', error, errorDescription);
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
  // Cookie-based state validation is mandatory for CSRF protection
  const cookieStore = await cookies();
  const storedState = cookieStore.get('linkedin_oauth_state')?.value;

  if (!storedState || !state || state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
        'Invalid state parameter - possible CSRF attack'
      )}`
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code, baseUrl);

    // Fetch user profile information
    const userInfo = await fetchUserInfo(tokenResponse.access_token);

    // Get authenticated user from Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Calculate token expiration
    // LinkedIn access tokens expire in 60 days (5184000 seconds)
    const expiresAt = new Date(
      Date.now() + (tokenResponse.expires_in || 5184000) * 1000
    );

    // Encrypt tokens before storage
    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('SUPABASE_ENCRYPTION_SECRET not configured');
    }

    const { data: encryptedAccessToken, error: encryptAccessError } = await supabase.rpc(
      'encrypt_token', { token: tokenResponse.access_token, secret: encryptionSecret }
    );

    if (encryptAccessError) {
      console.error('Failed to encrypt access token:', encryptAccessError);
      throw new Error('Failed to encrypt access token');
    }

    let encryptedRefreshToken = null;
    if (tokenResponse.refresh_token) {
      const { data: encryptedRefresh, error: encryptRefreshError } = await supabase.rpc(
        'encrypt_token', { token: tokenResponse.refresh_token, secret: encryptionSecret }
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
        user_id: user.id,
        platform: 'linkedin',
        account_id: userInfo.sub,
        account_name: userInfo.name,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt.toISOString(),
        scopes: tokenResponse.scope.split(' '),
        is_active: true,
        metadata: {
          email: userInfo.email,
          picture: userInfo.picture,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform,account_id',
      }
    );

    if (upsertError) {
      console.error('Failed to store LinkedIn credentials:', upsertError);
      throw new Error('Failed to save LinkedIn account');
    }

    // Clear the OAuth state cookie
    const response = NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?success=linkedin`
    );

    response.cookies.delete('linkedin_oauth_state');

    return response;
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(message)}`
    );
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  baseUrl: string
): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth credentials not configured');
  }

  const redirectUri = `${baseUrl}/auth/callback/linkedin`;

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LinkedIn token exchange failed:', errorText);
    throw new Error('Failed to exchange authorization code for token');
  }

  const data: LinkedInTokenResponse = await response.json();
  return data;
}

/**
 * Fetch LinkedIn user profile information
 */
async function fetchUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LinkedIn userinfo fetch failed:', errorText);
    throw new Error('Failed to fetch LinkedIn user profile');
  }

  const data: LinkedInUserInfo = await response.json();
  return data;
}
