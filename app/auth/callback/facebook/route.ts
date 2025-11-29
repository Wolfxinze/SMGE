/**
 * Facebook OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from Facebook after user authorization.
 * Exchanges the authorization code for access tokens and stores credentials.
 *
 * OAuth Flow:
 * 1. User clicks "Connect Facebook" -> redirected to Facebook authorization
 * 2. User authorizes app -> Facebook redirects here with authorization code
 * 3. This handler exchanges code for short-lived token
 * 4. Short-lived token exchanged for long-lived token (60 days)
 * 5. Fetches user's Facebook Pages
 * 6. Tokens are stored in database (encrypted)
 * 7. User redirected to success page
 *
 * Required Environment Variables:
 * - FACEBOOK_CLIENT_ID
 * - FACEBOOK_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 * - SUPABASE_ENCRYPTION_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

/**
 * GET handler for Facebook OAuth callback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from Facebook
  if (error) {
    console.error('Facebook OAuth error:', error, errorDescription);
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

  // Validate state to prevent CSRF attacks
  const cookieStore = await cookies();
  const storedState = cookieStore.get('facebook_oauth_state')?.value;

  if (!state || state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(
        'Invalid state parameter - possible CSRF attack'
      )}`
    );
  }

  try {
    // Exchange authorization code for short-lived access token
    const shortLivedToken = await exchangeCodeForToken(code, baseUrl);

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken.access_token);

    // Fetch user profile information
    const userInfo = await fetchUserInfo(longLivedToken.access_token);

    // Fetch user's Facebook Pages
    const pages = await fetchUserPages(longLivedToken.access_token);

    // Get authenticated user from Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Calculate token expiration (long-lived tokens last 60 days)
    const expiresAt = new Date(
      Date.now() + (longLivedToken.expires_in || 5184000) * 1000
    );

    // Encrypt tokens before storage
    const encryptionSecret = process.env.SUPABASE_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('SUPABASE_ENCRYPTION_SECRET not configured');
    }

    const { data: encryptedAccessToken, error: encryptAccessError } = await supabase.rpc(
      'encrypt_token', { token: longLivedToken.access_token, secret: encryptionSecret }
    );

    if (encryptAccessError) {
      console.error('Failed to encrypt access token:', encryptAccessError);
      throw new Error('Failed to encrypt access token');
    }

    // Store the main Facebook user account
    const { error: upsertError } = await supabase.from('social_accounts').upsert(
      {
        user_id: user.id,
        platform: 'facebook',
        account_id: userInfo.id,
        account_name: userInfo.name,
        access_token_encrypted: encryptedAccessToken,
        token_expires_at: expiresAt.toISOString(),
        scopes: ['pages_manage_posts', 'pages_read_engagement', 'public_profile'],
        is_active: true,
        metadata: {
          email: userInfo.email,
          picture: userInfo.picture?.data?.url,
          account_type: 'user',
          pages: pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform,account_id',
      }
    );

    if (upsertError) {
      console.error('Failed to store Facebook credentials:', upsertError);
      throw new Error('Failed to save Facebook account');
    }

    // Store each Facebook Page as a separate social account
    for (const page of pages) {
      // Encrypt page access token
      const { data: encryptedPageToken, error: encryptPageError } = await supabase.rpc(
        'encrypt_token', { token: page.access_token, secret: encryptionSecret }
      );

      if (encryptPageError) {
        console.error(`Failed to encrypt page token for ${page.name}:`, encryptPageError);
        continue; // Skip this page but continue with others
      }

      // Page tokens don't expire as long as the user token is valid
      const pageExpiresAt = expiresAt;

      const { error: pageUpsertError } = await supabase.from('social_accounts').upsert(
        {
          user_id: user.id,
          platform: 'facebook',
          account_id: page.id,
          account_name: `${page.name} (Page)`,
          access_token_encrypted: encryptedPageToken,
          token_expires_at: pageExpiresAt.toISOString(),
          scopes: ['pages_manage_posts', 'pages_read_engagement'],
          is_active: true,
          metadata: {
            account_type: 'page',
            category: page.category,
            parent_user_id: userInfo.id,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,platform,account_id',
        }
      );

      if (pageUpsertError) {
        console.error(`Failed to store Facebook Page ${page.name}:`, pageUpsertError);
      }
    }

    // Clear the OAuth state cookie
    const response = NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?success=facebook`
    );

    response.cookies.delete('facebook_oauth_state');

    return response;
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.redirect(
      `${baseUrl}/profile/social-accounts?error=${encodeURIComponent(message)}`
    );
  }
}

/**
 * Exchange authorization code for short-lived access token
 */
async function exchangeCodeForToken(
  code: string,
  baseUrl: string
): Promise<FacebookTokenResponse> {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Facebook OAuth credentials not configured');
  }

  const redirectUri = `${baseUrl}/auth/callback/facebook`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${FACEBOOK_API_BASE}/oauth/access_token?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Facebook token exchange failed:', errorText);
    throw new Error('Failed to exchange authorization code for token');
  }

  const data: FacebookTokenResponse = await response.json();
  return data;
}

/**
 * Exchange short-lived token for long-lived token
 */
async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<FacebookTokenResponse> {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Facebook OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${FACEBOOK_API_BASE}/oauth/access_token?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Facebook long-lived token exchange failed:', errorText);
    throw new Error('Failed to get long-lived access token');
  }

  const data: FacebookTokenResponse = await response.json();
  return data;
}

/**
 * Fetch Facebook user profile information
 * SECURITY: Uses Authorization header instead of URL parameter to prevent token leakage
 */
async function fetchUserInfo(accessToken: string): Promise<FacebookUserInfo> {
  const response = await fetch(
    `${FACEBOOK_API_BASE}/me?fields=id,name,email,picture`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Facebook userinfo fetch failed:', errorText);
    throw new Error('Failed to fetch Facebook user profile');
  }

  const data: FacebookUserInfo = await response.json();
  return data;
}

/**
 * Fetch user's Facebook Pages
 * SECURITY: Uses Authorization header instead of URL parameter to prevent token leakage
 */
async function fetchUserPages(accessToken: string): Promise<FacebookPage[]> {
  const response = await fetch(
    `${FACEBOOK_API_BASE}/me/accounts?fields=id,name,access_token,category`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Facebook pages fetch failed:', errorText);
    // Don't throw - user might not have any pages
    return [];
  }

  const data = await response.json();
  return data.data || [];
}
