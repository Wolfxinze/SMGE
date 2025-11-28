/**
 * API Route: Generate Response
 * Endpoint for generating AI responses to engagement items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateResponse, generateResponseVariants } from '@/lib/services/engagement-ai';
import type { GenerateResponseRequest } from '@/lib/types/engagement';

/**
 * POST /api/engagement/generate
 * Generate AI response for an engagement item
 */
export async function POST(request: NextRequest) {
  // Store body data in outer scope for error recovery
  let engagementItemId: string | undefined;

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

    const body: GenerateResponseRequest = await request.json();
    engagementItemId = body.engagement_item_id;

    // Validate required fields
    if (!body.engagement_item_id || !body.brand_id) {
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

    // Verify engagement item belongs to brand
    const { data: item } = await supabase
      .from('engagement_items')
      .select('id, brand_id, status')
      .eq('id', body.engagement_item_id)
      .single();

    if (!item || item.brand_id !== body.brand_id) {
      return NextResponse.json(
        { error: 'Engagement item not found or access denied' },
        { status: 403 }
      );
    }

    // Check if response already generated
    const { data: existingResponse } = await supabase
      .from('generated_responses')
      .select('id')
      .eq('engagement_item_id', body.engagement_item_id)
      .eq('approval_status', 'pending')
      .single();

    if (existingResponse) {
      return NextResponse.json(
        { error: 'Response already generated for this engagement item' },
        { status: 409 }
      );
    }

    // Update engagement item status
    await supabase
      .from('engagement_items')
      .update({ status: 'processing' })
      .eq('id', body.engagement_item_id);

    // Generate response(s)
    let responses;
    if (body.variant_count && body.variant_count > 1) {
      responses = await generateResponseVariants(
        body.engagement_item_id,
        body.brand_id,
        body.variant_count
      );
    } else {
      const response = await generateResponse(body.engagement_item_id, body.brand_id);
      responses = [response];
    }

    return NextResponse.json({ responses }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/engagement/generate error:', error);

    // Revert engagement item status on error using stored ID
    if (engagementItemId) {
      try {
        const supabase = await createClient();
        await supabase
          .from('engagement_items')
          .update({ status: 'pending' })
          .eq('id', engagementItemId);
      } catch (updateError) {
        console.error('Failed to revert status:', updateError);
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
