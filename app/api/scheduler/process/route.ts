import { NextRequest, NextResponse } from 'next/server';
import { processScheduledPosts } from '@/lib/scheduler/queue-processor';

/**
 * Internal API endpoint for processing scheduled posts
 * Called by Supabase Edge Function cron job
 *
 * POST /api/scheduler/process
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from Supabase (check service role key)
    const authHeader = request.headers.get('authorization');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid service role key' },
        { status: 401 }
      );
    }

    // Process scheduled posts using the queue processor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const result = await processScheduledPosts(supabaseUrl, supabaseServiceKey);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing scheduled posts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
