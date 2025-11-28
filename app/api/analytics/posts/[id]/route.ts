/**
 * API Route: Post Analytics
 * Endpoint for fetching detailed analytics for a specific post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/posts/[id]
 * Get detailed analytics for a specific post
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: postId } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // Call the database function
    // Type assertion needed - function exists in database but not yet in generated types
    const { data: analytics, error } = await (supabase as any).rpc('get_post_analytics', {
      p_post_id: postId,
    });

    if (error) {
      // Check if it's an authorization error
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Access denied to this post' },
          { status: 403 }
        );
      }

      console.error('Post analytics error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch post analytics', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ analytics });
  } catch (error: any) {
    console.error('GET /api/analytics/posts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
