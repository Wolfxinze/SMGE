/**
 * API Route: Content Insights
 * Endpoint for fetching content performance insights for AI recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/insights
 * Get content performance insights
 * Query params:
 * - brand_id (required): Brand UUID
 * - days (optional): Number of days to analyze (default: 30)
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
      return NextResponse.json(
        { error: 'brand_id is required' },
        { status: 400 }
      );
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 403 }
      );
    }

    // Call the database function
    // Type assertion needed - function exists in database but not yet in generated types
    const { data: insights, error } = await (supabase as any).rpc('get_content_insights', {
      p_brand_id: brandId,
      p_days: days,
    });

    if (error) {
      console.error('Content insights error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch insights', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      insights,
      period_days: days,
    });
  } catch (error: any) {
    console.error('GET /api/analytics/insights error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
