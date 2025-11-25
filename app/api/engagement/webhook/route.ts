/**
 * API Route: Engagement Webhook
 * Webhook endpoint for receiving engagement events from n8n workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeSentiment, calculatePriority, generateResponse } from '@/lib/services/engagement-ai';
import type { WebhookPayload } from '@/lib/types/engagement';

/**
 * POST /api/engagement/webhook
 * Receive engagement events from n8n monitoring workflows
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const payload: WebhookPayload = await request.json();

    // Validate required fields
    if (!payload.platform || !payload.social_account_id || !payload.event_type || !payload.data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get social account and brand
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, user_id')
      .eq('id', payload.social_account_id)
      .eq('platform', payload.platform)
      .single();

    if (accountError || !socialAccount) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 });
    }

    // Get brand for this user (assuming one active brand per user for MVP)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', socialAccount.user_id)
      .eq('is_active', true)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'No active brand found for user' }, { status: 404 });
    }

    // Extract engagement details from platform-specific data
    const engagementData = extractEngagementData(payload);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('engagement_items')
      .select('id')
      .eq('platform', payload.platform)
      .eq('external_id', engagementData.external_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { message: 'Engagement already processed', id: existing.id },
        { status: 200 }
      );
    }

    // Analyze sentiment
    const sentimentAnalysis = await analyzeSentiment(engagementData.content);

    // Determine if influencer (check follower count if available)
    const isInfluencer =
      engagementData.author_follower_count && engagementData.author_follower_count > 10000;

    // Calculate priority
    const priority = calculatePriority(
      sentimentAnalysis.sentiment,
      isInfluencer || false,
      sentimentAnalysis.intent
    );

    // Check for spam
    const isSpam =
      sentimentAnalysis.intent === 'spam' ||
      engagementData.content.match(/https?:\/\//g)?.length > 3 ||
      engagementData.content.length < 3;

    // Create engagement item
    const { data: item, error: itemError } = await supabase
      .from('engagement_items')
      .insert({
        brand_id: brand.id,
        platform: payload.platform,
        social_account_id: payload.social_account_id,
        engagement_type: payload.event_type === 'dm' ? 'dm' : 'comment',
        external_id: engagementData.external_id,
        parent_post_id: engagementData.parent_post_id,
        author_username: engagementData.author_username,
        author_display_name: engagementData.author_display_name,
        author_profile_url: engagementData.author_profile_url,
        content: engagementData.content,
        original_post_content: engagementData.original_post_content,
        conversation_context: engagementData.conversation_context,
        sentiment: sentimentAnalysis.sentiment,
        sentiment_score: sentimentAnalysis.score,
        detected_intent: sentimentAnalysis.intent,
        priority,
        is_spam: isSpam,
        requires_response: !isSpam,
        is_influencer: isInfluencer || false,
        status: 'pending',
        raw_data: payload.data,
      })
      .select()
      .single();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    // Auto-generate response if not spam and requires response
    if (!isSpam && item.requires_response) {
      // Generate response asynchronously (don't block webhook response)
      generateResponse(item.id, brand.id).catch((err) => {
        console.error('Auto-generation failed:', err);
      });
    }

    return NextResponse.json(
      {
        message: 'Engagement processed successfully',
        engagement_id: item.id,
        requires_response: item.requires_response,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/engagement/webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Extract engagement data from platform-specific webhook payload
 */
function extractEngagementData(payload: WebhookPayload): {
  external_id: string;
  parent_post_id?: string;
  author_username: string;
  author_display_name?: string;
  author_profile_url?: string;
  author_follower_count?: number;
  content: string;
  original_post_content?: string;
  conversation_context?: Array<{ author: string; content: string; timestamp: string }>;
} {
  const data = payload.data;

  // Platform-specific extraction
  switch (payload.platform) {
    case 'instagram':
      return {
        external_id: data.id || data.comment_id,
        parent_post_id: data.media_id || data.post_id,
        author_username: data.from?.username || data.username,
        author_display_name: data.from?.name,
        author_profile_url: data.from?.profile_picture_url,
        author_follower_count: data.from?.followers_count,
        content: data.text || data.message,
        original_post_content: data.media?.caption,
      };

    case 'twitter':
      return {
        external_id: data.id,
        parent_post_id: data.referenced_tweets?.[0]?.id,
        author_username: data.author?.username,
        author_display_name: data.author?.name,
        author_profile_url: `https://twitter.com/${data.author?.username}`,
        author_follower_count: data.author?.public_metrics?.followers_count,
        content: data.text,
        original_post_content: data.referenced_tweets?.[0]?.text,
      };

    case 'linkedin':
      return {
        external_id: data.id,
        parent_post_id: data.parentId || data.root,
        author_username: data.author?.vanityName || data.author?.localizedName,
        author_display_name: data.author?.localizedName,
        author_profile_url: `https://www.linkedin.com/in/${data.author?.vanityName}`,
        content: data.message?.text || data.text,
        original_post_content: data.root?.text,
      };

    case 'tiktok':
      return {
        external_id: data.comment_id || data.id,
        parent_post_id: data.video_id,
        author_username: data.user?.unique_id,
        author_display_name: data.user?.nickname,
        author_profile_url: `https://www.tiktok.com/@${data.user?.unique_id}`,
        author_follower_count: data.user?.follower_count,
        content: data.text || data.comment_text,
        original_post_content: data.video?.description,
      };

    default:
      // Generic fallback
      return {
        external_id: data.id || String(Date.now()),
        author_username: data.username || data.author || 'unknown',
        content: data.content || data.text || data.message || '',
      };
  }
}
