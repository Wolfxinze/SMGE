/**
 * API Route: Approval Queue
 * Endpoint for fetching pending responses for approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/engagement/queue
 * Get approval queue for a brand
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

    // Use the get_approval_queue database function
    const { data: queue, error } = await supabase.rpc('get_approval_queue', {
      p_brand_id: brandId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ queue }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/engagement/queue error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
