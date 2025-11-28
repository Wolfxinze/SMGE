/**
 * API Route: Engagement Analytics
 * Endpoint for fetching engagement metrics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/engagement/analytics
 * Get engagement analytics for a brand
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
    const days = parseInt(searchParams.get('days') || '30', 10);

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

    // Use the get_engagement_analytics database function
    const { data: analytics, error } = await supabase.rpc('get_engagement_analytics', {
      p_brand_id: brandId,
      p_days: days,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analytics }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/engagement/analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
