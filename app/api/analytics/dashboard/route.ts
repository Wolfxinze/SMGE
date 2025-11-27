/**
 * API Route: Dashboard Analytics
 * Endpoint for fetching consolidated analytics dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/dashboard
 * Get consolidated analytics for the dashboard
 * Query params:
 * - brand_id (required): Brand UUID
 * - start_date (optional): Start date for analytics range (ISO 8601)
 * - end_date (optional): End date for analytics range (ISO 8601)
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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!brandId) {
      return NextResponse.json(
        { error: 'brand_id is required' },
        { status: 400 }
      );
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 403 }
      );
    }

    // Prepare function parameters
    const params: any = { p_brand_id: brandId };

    if (startDate) {
      params.p_start_date = startDate;
    }

    if (endDate) {
      params.p_end_date = endDate;
    }

    // Call the database function
    // Type assertion needed - function exists in database but not yet in generated types
    const { data: analytics, error } = await (supabase as any).rpc(
      'get_dashboard_analytics',
      params
    );

    if (error) {
      console.error('Dashboard analytics error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brand: {
        id: brand.id,
        name: brand.name,
      },
      analytics,
      period: {
        start_date: startDate || 'Last 30 days',
        end_date: endDate || 'Now',
      },
    });
  } catch (error: any) {
    console.error('GET /api/analytics/dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
