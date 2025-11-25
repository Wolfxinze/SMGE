/**
 * API Route: Approve/Reject Response
 * Endpoints for managing response approval workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { postResponse } from '@/lib/services/engagement-poster';
import type { ApproveResponseRequest, RejectResponseRequest } from '@/lib/types/engagement';

/**
 * POST /api/engagement/approve
 * Approve a generated response (with optional edits)
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

    const body: ApproveResponseRequest = await request.json();

    // Validate required fields
    if (!body.response_id) {
      return NextResponse.json({ error: 'response_id is required' }, { status: 400 });
    }

    // Use the approve_response database function
    const { data, error } = await supabase.rpc('approve_response', {
      p_response_id: body.response_id,
      p_edited_text: body.edited_text || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger posting (async - don't wait)
    postResponse(body.response_id).catch((err) => {
      console.error('Posting failed after approval:', err);
    });

    return NextResponse.json({ response: data }, { status: 200 });
  } catch (error: any) {
    console.error('POST /api/engagement/approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/engagement/approve (reject)
 * Reject a generated response
 */
export async function DELETE(request: NextRequest) {
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

    const body: RejectResponseRequest = await request.json();

    // Validate required fields
    if (!body.response_id || !body.reason) {
      return NextResponse.json(
        { error: 'response_id and reason are required' },
        { status: 400 }
      );
    }

    // Use the reject_response database function
    const { data, error } = await supabase.rpc('reject_response', {
      p_response_id: body.response_id,
      p_reason: body.reason,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ response: data }, { status: 200 });
  } catch (error: any) {
    console.error('DELETE /api/engagement/approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
