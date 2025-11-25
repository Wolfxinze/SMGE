import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from headers
    const secret = request.headers.get('x-webhook-secret');

    if (!secret) {
      return NextResponse.json({ error: 'Missing webhook secret' }, { status: 401 });
    }

    // Use constant-time comparison to prevent timing attacks
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET || '';
    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expectedSecret);

    const isValid =
      secret.length === expectedSecret.length &&
      secretBuffer.length === expectedBuffer.length &&
      timingSafeEqual(secretBuffer, expectedBuffer);

    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.data) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const supabase = await createClient();

    switch (body.type) {
      case 'engagement_detected':
        return handleEngagementDetected(supabase, body.data);

      case 'response_approved':
        return handleResponseApproved(supabase, body.data);

      case 'post_response':
        return handlePostResponse(supabase, body.data);

      default:
        return NextResponse.json({ error: `Unknown webhook type: ${body.type}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function handleEngagementDetected(supabase: any, data: any) {
  try {
    // Validate required data fields
    const requiredFields = ['brand_id', 'platform', 'external_id', 'content', 'author_username'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Determine if influencer based on follower count or explicit flag
    const isInfluencer = data.is_influencer ||
      (data.author_follower_count && data.author_follower_count > 10000) ||
      false;

    // Insert engagement item with ON CONFLICT handling
    const { data: newItem, error: insertError } = await supabase
      .from('engagement_items')
      .insert({
        brand_id: data.brand_id,
        platform: data.platform,
        external_id: data.external_id,
        content_type: data.content_type || 'post',
        author_username: data.author_username,
        author_display_name: data.author_display_name,
        author_follower_count: data.author_follower_count || 0,
        is_influencer: isInfluencer,
        content: data.content,
        media_urls: data.media_urls || [],
        engagement_metrics: data.engagement_metrics || {},
        sentiment_score: data.sentiment_score,
        priority: data.priority || 5,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate item - already processed
        console.log('Duplicate engagement from webhook ignored:', data.external_id);
        return NextResponse.json({
          message: 'Engagement already processed',
          duplicate: true
        });
      }
      throw insertError;
    }

    return NextResponse.json({
      message: 'Engagement queued successfully',
      item_id: newItem.id
    });
  } catch (error) {
    console.error('Error handling engagement detected:', error);
    return NextResponse.json(
      { error: 'Failed to queue engagement' },
      { status: 500 }
    );
  }
}

async function handleResponseApproved(supabase: any, data: any) {
  try {
    if (!data.response_id) {
      return NextResponse.json({ error: 'Missing response_id' }, { status: 400 });
    }

    // Update response status
    const { error } = await supabase
      .from('engagement_responses')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', data.response_id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: 'Response approved successfully'
    });
  } catch (error) {
    console.error('Error handling response approved:', error);
    return NextResponse.json(
      { error: 'Failed to approve response' },
      { status: 500 }
    );
  }
}

async function handlePostResponse(supabase: any, data: any) {
  try {
    if (!data.response_id || !data.platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get response details
    const { data: response, error } = await supabase
      .from('engagement_responses')
      .select(`
        *,
        engagement_item:engagement_items (*)
      `)
      .eq('id', data.response_id)
      .single();

    if (error || !response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Here you would typically call the poster service
    // For now, just update the status
    const { error: updateError } = await supabase
      .from('engagement_responses')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', data.response_id);

    if (updateError) {
      throw updateError;
    }

    // Update engagement item status
    await supabase
      .from('engagement_items')
      .update({
        status: 'responded',
        responded_at: new Date().toISOString(),
        response_id: data.response_id
      })
      .eq('id', response.engagement_item_id);

    return NextResponse.json({
      message: 'Response posted successfully'
    });
  } catch (error) {
    console.error('Error handling post response:', error);
    return NextResponse.json(
      { error: 'Failed to post response' },
      { status: 500 }
    );
  }
}