/**
 * Schedule Post API
 * POST /api/scheduler/schedule
 *
 * Creates scheduled posts for one or more social accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SchedulePostRequest } from '@/lib/scheduler/types';
import { isPlatformSupported } from '@/lib/scheduler/config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SchedulePostRequest = await request.json();
    const { post_id, social_account_ids, scheduled_for, timezone = 'UTC' } = body;

    // Validate required fields
    if (!post_id || !social_account_ids || !Array.isArray(social_account_ids)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (social_account_ids.length === 0) {
      return NextResponse.json(
        { error: 'At least one social account required' },
        { status: 400 }
      );
    }

    if (!scheduled_for) {
      return NextResponse.json(
        { error: 'scheduled_for timestamp required' },
        { status: 400 }
      );
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduled_for);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Fetch and validate post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*, brands!inner(id, user_id)')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify post ownership
    if (post.brands.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to schedule this post' },
        { status: 403 }
      );
    }

    // Validate social accounts belong to user
    const { data: socialAccounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id, platform, is_active')
      .in('id', social_account_ids)
      .eq('user_id', user.id);

    if (accountsError || !socialAccounts || socialAccounts.length !== social_account_ids.length) {
      return NextResponse.json(
        { error: 'Invalid social accounts' },
        { status: 400 }
      );
    }

    // Check for inactive accounts
    const inactiveAccounts = socialAccounts.filter(acc => !acc.is_active);
    if (inactiveAccounts.length > 0) {
      return NextResponse.json(
        { error: 'Some social accounts are inactive or disconnected' },
        { status: 400 }
      );
    }

    // Validate platform support
    const unsupportedAccounts = socialAccounts.filter(acc => !isPlatformSupported(acc.platform));
    if (unsupportedAccounts.length > 0) {
      const platforms = [...new Set(unsupportedAccounts.map(acc => acc.platform))];
      return NextResponse.json(
        {
          error: `Platform(s) not yet supported: ${platforms.join(', ')}. Currently only Twitter is available.`,
          supported_platforms: ['twitter']
        },
        { status: 400 }
      );
    }

    // Create scheduled posts
    const scheduledPosts = social_account_ids.map(accountId => ({
      post_id,
      social_account_id: accountId,
      brand_id: post.brand_id,
      scheduled_for,
      timezone,
      status: 'pending' as const,
    }));

    const { data: created, error: createError } = await supabase
      .from('scheduled_posts')
      .insert(scheduledPosts)
      .select();

    if (createError) {
      // Handle duplicate scheduling error
      if (createError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Post already scheduled for one or more accounts' },
          { status: 409 }
        );
      }

      console.error('Error creating scheduled posts:', createError);
      throw createError;
    }

    // Update post status to scheduled
    await supabase
      .from('posts')
      .update({ status: 'scheduled' })
      .eq('id', post_id);

    return NextResponse.json({
      success: true,
      scheduled_posts: created,
      scheduled_count: created.length,
    });
  } catch (error) {
    console.error('Schedule post error:', error);
    return NextResponse.json(
      { error: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

/**
 * Get Scheduled Posts
 * GET /api/scheduler/schedule?brand_id=xxx&start=xxx&end=xxx
 *
 * Retrieves scheduled posts for calendar view
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brand_id');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('scheduled_posts')
      .select(`
        *,
        posts (
          id,
          content_type,
          title,
          body,
          media_urls,
          hashtags,
          status
        ),
        social_accounts (
          id,
          platform,
          account_name,
          is_active
        )
      `)
      .order('scheduled_for', { ascending: true });

    // Filter by brand
    if (brandId) {
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

      query = query.eq('brand_id', brandId);
    } else {
      // Filter to user's brands only
      const { data: userBrands } = await supabase
        .from('brands')
        .select('id')
        .eq('user_id', user.id);

      const brandIds = userBrands?.map(b => b.id) || [];
      query = query.in('brand_id', brandIds);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('scheduled_for', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_for', endDate);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    const { data: scheduledPosts, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      throw queryError;
    }

    return NextResponse.json({
      scheduled_posts: scheduledPosts || [],
      count: scheduledPosts?.length || 0,
    });
  } catch (error) {
    console.error('Get scheduled posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled posts' },
      { status: 500 }
    );
  }
}
