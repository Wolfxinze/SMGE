import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EngagementAIService } from '@/lib/services/engagement-ai';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id');
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    // Verify user owns this brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('engagement_items')
      .select(`
        *,
        engagement_responses (
          id,
          content,
          confidence_score,
          status,
          created_at
        )
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error('Error fetching engagement items:', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({ items, total: items?.length || 0 });
  } catch (error) {
    console.error('Error in GET /api/engagement/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['brandId', 'platform', 'externalId', 'contentType', 'authorUsername', 'content'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Verify user owns this brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', body.brandId)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Analyze sentiment if not provided
    let sentimentScore = body.sentimentScore;
    if (sentimentScore === undefined) {
      const aiService = new EngagementAIService();
      sentimentScore = await aiService.analyzeSentiment(body.content);
    }

    // Detect intent
    const aiService = new EngagementAIService();
    const intent = await aiService.detectIntent(body.content);

    // Calculate priority based on various factors
    let priority = 5;
    if (body.isInfluencer || (body.authorFollowerCount && body.authorFollowerCount > 10000)) {
      priority = Math.min(10, priority + 3);
    }
    if (sentimentScore < -0.5) {
      priority = Math.min(10, priority + 2);
    }
    if (intent === 'complaint') {
      priority = Math.min(10, priority + 2);
    }

    // Determine if influencer (using follower count or explicit flag)
    const isInfluencer = body.isInfluencer ||
      (body.authorFollowerCount && body.authorFollowerCount > 10000) ||
      false;

    // Insert the engagement item with ON CONFLICT handling for race condition fix
    const { data: newItem, error: insertError } = await (supabase
      .from('engagement_items') as any)
      .insert({
        brand_id: body.brandId,
        platform: body.platform,
        external_id: body.externalId,
        content_type: body.contentType,
        author_username: body.authorUsername,
        author_display_name: body.authorDisplayName,
        author_follower_count: body.authorFollowerCount || 0,
        is_influencer: isInfluencer,
        content: body.content,
        media_urls: body.mediaUrls || [],
        engagement_metrics: body.engagementMetrics || {},
        sentiment_score: sentimentScore,
        priority: priority,
        status: 'pending'
      })
      .select()
      .single();

    // Handle duplicate key error (race condition fix)
    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation - item already exists
        console.log('Duplicate engagement item ignored:', body.externalId);

        // Fetch the existing item
        const { data: existingItem } = await supabase
          .from('engagement_items')
          .select('*')
          .eq('platform', body.platform)
          .eq('external_id', body.externalId)
          .single();

        return NextResponse.json(
          {
            message: 'Item already processed',
            item: existingItem
          },
          { status: 200 }  // 200, not 201, for idempotency
        );
      }

      console.error('Error inserting engagement item:', insertError);
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    // Check if auto-response should be triggered
    const shouldAutoRespond = await aiService.shouldAutoRespond(
      {
        brand_id: body.brandId,
        platform: body.platform,
        content: body.content,
        author_username: body.authorUsername,
        sentiment_score: sentimentScore,
        is_influencer: isInfluencer
      },
      0.85 // Default confidence threshold
    );

    if (shouldAutoRespond) {
      // Trigger auto-response generation
      // This would typically be done via a background job or webhook
      console.log('Auto-response triggered for item:', newItem.id);
    }

    return NextResponse.json(
      {
        message: 'Engagement item created',
        item: newItem,
        autoResponseTriggered: shouldAutoRespond
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/engagement/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}