/**
 * Social Platform OAuth Initiation
 * GET /api/scheduler/oauth/:platform
 *
 * Initiates OAuth flow for connecting social media accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformOAuthManager } from '@/lib/scheduler/platforms/base';
import type { SocialPlatform } from '@/lib/scheduler/types';

const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'twitter',
  'linkedin',
  'tiktok',
  'facebook',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformParam } = await params;
    const platform = platformParam as SocialPlatform;

    // Validate platform
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get brand_id from query params
    const brandId = request.nextUrl.searchParams.get('brand_id');
    if (!brandId) {
      return NextResponse.json(
        { error: 'brand_id parameter required' },
        { status: 400 }
      );
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or unauthorized' },
        { status: 404 }
      );
    }

    // Generate state parameter (includes brand_id and user_id for validation)
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        brand_id: brandId,
        timestamp: Date.now(),
      })
    ).toString('base64url');

    // Get OAuth authorization URL
    const authUrl = PlatformOAuthManager.getAuthorizationUrl(platform, state);

    return NextResponse.json({
      authorization_url: authUrl,
      platform,
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
