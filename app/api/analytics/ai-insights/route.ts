/**
 * API Route: AI Insights
 * Endpoint for generating AI-powered analytics insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/ai/insights-generator';

/**
 * POST /api/analytics/ai-insights
 * Generate AI insights from analytics data
 * Body:
 * - brand_id (required): Brand UUID
 * - days (optional): Number of days to analyze (default: 30)
 * - model (optional): AI model to use ('openai' | 'claude', default: 'openai')
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

    // Parse request body
    const body = await request.json();
    const { brand_id, days = 30, model = 'openai' } = body;

    if (!brand_id) {
      return NextResponse.json(
        { error: 'brand_id is required' },
        { status: 400 }
      );
    }

    // Verify brand ownership and get brand name
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brand_id)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch content insights from database
    // Type assertion needed - function exists in database but not yet in generated types
    const { data: insights, error: insightsError } = await (supabase as any).rpc(
      'get_content_insights',
      {
        p_brand_id: brand_id,
        p_days: days,
      }
    );

    if (insightsError) {
      console.error('Content insights error:', insightsError);
      return NextResponse.json(
        { error: 'Failed to fetch insights data', details: insightsError.message },
        { status: 500 }
      );
    }

    // Check if we have enough data for insights
    if (!insights || Object.keys(insights).length === 0) {
      return NextResponse.json({
        insights: [],
        message: 'Not enough data available for insights. Publish more posts to get AI recommendations.',
      });
    }

    // Generate AI insights
    const aiInsights = await generateInsights(insights, brand.name, model);

    return NextResponse.json({
      insights: aiInsights,
      brand: {
        id: brand.id,
        name: brand.name,
      },
      period_days: days,
      model_used: model,
    });
  } catch (error: any) {
    console.error('POST /api/analytics/ai-insights error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
