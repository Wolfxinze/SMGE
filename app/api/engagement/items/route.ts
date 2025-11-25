/**
 * API Route: Engagement Items
 * Endpoints for creating and listing engagement items (comments/DMs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeSentiment, calculatePriority } from '@/lib/services/engagement-ai';
import type { CreateEngagementItemRequest } from '@/lib/types/engagement';

/**
 * GET /api/engagement/items
 * List engagement items for a brand with optional filters
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brand_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!brandId) {
      return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
    }

    // Verify brand ownership
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('engagement_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (platform) query = query.eq('platform', platform);

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/engagement/items error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/engagement/items
 * Create new engagement item from webhook or manual input
 */
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

    const body: CreateEngagementItemRequest = await request.json();

    // Validate required fields
    if (
      !body.brand_id ||
      !body.platform ||
      !body.social_account_id ||
      !body.engagement_type ||
      !body.external_id ||
      !body.author_username ||
      !body.content
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify brand ownership
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', body.brand_id)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 403 });
    }

    // Verify social account ownership
    const { data: socialAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('id', body.social_account_id)
      .eq('user_id', user.id)
      .single();

    if (!socialAccount) {
      return NextResponse.json(
        { error: 'Social account not found or access denied' },
        { status: 403 }
      );
    }

    // Note: Duplicate check removed - we'll handle it with unique constraint error below

    // Analyze sentiment
    const sentimentAnalysis = await analyzeSentiment(body.content);

    // Determine if influencer (placeholder - integrate with social APIs)
    const isInfluencer = false; // TODO: Check follower count from platform API

    // Calculate priority
    const priority = calculatePriority(
      sentimentAnalysis.sentiment,
      isInfluencer,
      sentimentAnalysis.intent
    );

    // Check for spam (simple heuristic)
    const isSpam =
      sentimentAnalysis.intent === 'spam' ||
      body.content.match(/https?:\/\//g)?.length > 3 || // Too many links
      body.content.length < 3; // Too short

    // Create engagement item
    const { data: item, error } = await supabase
      .from('engagement_items')
      .insert({
        brand_id: body.brand_id,
        platform: body.platform,
        social_account_id: body.social_account_id,
        engagement_type: body.engagement_type,
        external_id: body.external_id,
        parent_post_id: body.parent_post_id,
        author_username: body.author_username,
        author_display_name: body.author_display_name,
        author_profile_url: body.author_profile_url,
        content: body.content,
        original_post_content: body.original_post_content,
        conversation_context: body.conversation_context,
        sentiment: sentimentAnalysis.sentiment,
        sentiment_score: sentimentAnalysis.score,
        detected_intent: sentimentAnalysis.intent,
        priority,
        is_spam: isSpam,
        requires_response: !isSpam,
        is_influencer: isInfluencer,
        status: 'pending',
        raw_data: body.raw_data,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate key error (unique constraint violation)
      if (error.code === '23505') {
        // Try to fetch the existing item
        const { data: existing } = await supabase
          .from('engagement_items')
          .select('id')
          .eq('platform', body.platform)
          .eq('external_id', body.external_id)
          .single();

        if (existing) {
          return NextResponse.json(
            { message: 'Engagement item already exists', id: existing.id },
            { status: 200 } // 200 for idempotency
          );
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/engagement/items error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
