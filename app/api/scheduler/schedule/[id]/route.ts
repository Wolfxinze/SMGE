/**
 * Individual Scheduled Post Management
 * PATCH /api/scheduler/schedule/:id - Update scheduled post
 * DELETE /api/scheduler/schedule/:id - Cancel scheduled post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UpdateScheduleRequest } from '@/lib/scheduler/types';

/**
 * Update scheduled post (reschedule)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const scheduledPostId = id;

    // Parse request body
    const body: UpdateScheduleRequest = await request.json();
    const { scheduled_for, timezone } = body;

    if (!scheduled_for && !timezone) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Fetch scheduled post with ownership check
    const { data: scheduledPost, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*, brands!inner(user_id)')
      .eq('id', scheduledPostId)
      .single();

    if (fetchError || !scheduledPost) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (scheduledPost.brands.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this scheduled post' },
        { status: 403 }
      );
    }

    // Validate status (can't update already published or cancelled posts)
    if (['published', 'cancelled'].includes(scheduledPost.status)) {
      return NextResponse.json(
        { error: `Cannot update ${scheduledPost.status} post` },
        { status: 400 }
      );
    }

    // Validate new scheduled time
    if (scheduled_for) {
      const newScheduledDate = new Date(scheduled_for);
      if (newScheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'Scheduled time must be in the future' },
          { status: 400 }
        );
      }
    }

    // Update scheduled post
    const updates: any = { updated_at: new Date().toISOString() };
    if (scheduled_for) updates.scheduled_for = scheduled_for;
    if (timezone) updates.timezone = timezone;

    const { data: updated, error: updateError } = await supabase
      .from('scheduled_posts')
      .update(updates)
      .eq('id', scheduledPostId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      scheduled_post: updated,
    });
  } catch (error) {
    console.error('Update scheduled post error:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled post' },
      { status: 500 }
    );
  }
}

/**
 * Cancel scheduled post
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const scheduledPostId = id;

    // Fetch scheduled post with ownership check
    const { data: scheduledPost, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*, brands!inner(user_id)')
      .eq('id', scheduledPostId)
      .single();

    if (fetchError || !scheduledPost) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (scheduledPost.brands.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to cancel this scheduled post' },
        { status: 403 }
      );
    }

    // Validate status (can't cancel already published posts)
    if (scheduledPost.status === 'published') {
      return NextResponse.json(
        { error: 'Cannot cancel already published post' },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledPostId);

    if (updateError) {
      console.error('Cancel error:', updateError);
      throw updateError;
    }

    // Check if we should update parent post status
    const { data: otherSchedules } = await supabase
      .from('scheduled_posts')
      .select('status')
      .eq('post_id', scheduledPost.post_id)
      .neq('id', scheduledPostId);

    const allCancelled = otherSchedules?.every(s => s.status === 'cancelled');

    if (allCancelled || otherSchedules?.length === 0) {
      await supabase
        .from('posts')
        .update({ status: 'draft' })
        .eq('id', scheduledPost.post_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled post cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel scheduled post error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled post' },
      { status: 500 }
    );
  }
}

/**
 * Retry failed post
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const scheduledPostId = id;

    // Fetch scheduled post with ownership check
    const { data: scheduledPost, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*, brands!inner(user_id)')
      .eq('id', scheduledPostId)
      .single();

    if (fetchError || !scheduledPost) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (scheduledPost.brands.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to retry this post' },
        { status: 403 }
      );
    }

    // Validate status (must be failed)
    if (scheduledPost.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed posts can be retried' },
        { status: 400 }
      );
    }

    // Reset to pending and clear error
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'pending',
        error_message: null,
        error_code: null,
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledPostId)
      .select()
      .single();

    if (updateError) {
      console.error('Retry error:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      scheduled_post: updated,
      message: 'Post reset for retry',
    });
  } catch (error) {
    console.error('Retry scheduled post error:', error);
    return NextResponse.json(
      { error: 'Failed to retry post' },
      { status: 500 }
    );
  }
}
