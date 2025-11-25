import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EngagementAIService } from '@/lib/services/engagement-ai';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Store engagement_item_id in outer scope for error recovery
  let engagementItemId: string | undefined;

  try {
    const body = await request.json();
    engagementItemId = body.engagement_item_id;  // Store it here for error handler

    if (!engagementItemId) {
      return NextResponse.json({ error: 'engagement_item_id is required' }, { status: 400 });
    }

    // Get engagement item details
    const { data: engagementItem, error: itemError } = await supabase
      .from('engagement_items')
      .select('*')
      .eq('id', engagementItemId)
      .single();

    if (itemError || !engagementItem) {
      return NextResponse.json({ error: 'Engagement item not found' }, { status: 404 });
    }

    // Verify user owns this brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', (engagementItem as any).brand_id)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update status to processing
    await supabase
      .from('engagement_items')
      .update({ status: 'processing' } as any)
      .eq('id', engagementItemId);

    // Generate AI response
    const aiService = new EngagementAIService();
    const item = engagementItem as any;
    const generatedResponse = await aiService.generateResponse({
      brand_id: item.brand_id,
      platform: item.platform,
      content: item.content,
      author_username: item.author_username,
      sentiment_score: item.sentiment_score,
      is_influencer: item.is_influencer
    });

    // Check if a response already exists
    const { data: existingResponse } = await supabase
      .from('engagement_responses')
      .select('id')
      .eq('engagement_item_id', engagementItemId)
      .single();

    let responseData;
    if (existingResponse) {
      // Update existing response
      const { data, error } = await supabase
        .from('engagement_responses')
        .update({
          content: generatedResponse.content,
          confidence_score: generatedResponse.confidence_score,
          voice_similarity: generatedResponse.voice_similarity,
          suggested_edits: generatedResponse.suggested_edits,
          status: generatedResponse.confidence_score >= 0.85 ? 'approved' : 'pending',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', (existingResponse as any).id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      responseData = data;
    } else {
      // Create new response
      const { data, error } = await supabase
        .from('engagement_responses')
        .insert({
          engagement_item_id: engagementItemId,
          brand_id: item.brand_id,
          content: generatedResponse.content,
          confidence_score: generatedResponse.confidence_score,
          voice_similarity: generatedResponse.voice_similarity,
          suggested_edits: generatedResponse.suggested_edits,
          status: generatedResponse.confidence_score >= 0.85 ? 'approved' : 'pending'
        } as any)
        .select()
        .single();

      if (error) {
        throw error;
      }
      responseData = data;
    }

    // Update engagement item status back to pending if not auto-approved
    if (generatedResponse.confidence_score < 0.85) {
      await supabase
        .from('engagement_items')
        .update({ status: 'pending' } as any)
        .eq('id', engagementItemId);
    }

    return NextResponse.json({
      response: responseData,
      autoApproved: generatedResponse.confidence_score >= 0.85
    });
  } catch (error) {
    console.error('Response generation error:', error);

    // Use the stored engagementItemId instead of parsing JSON again
    if (engagementItemId) {
      await supabase
        .from('engagement_items')
        .update({
          status: 'pending',
          processing_error: error instanceof Error ? error.message : String(error)
        } as any)
        .eq('id', engagementItemId);
    }

    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}