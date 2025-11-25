import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if ((brand as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      content_type,
      platform,
      content,
      embedding,
      performance_score,
      engagement_metrics,
      content_metadata
    } = body;

    // Validate required fields
    if (!content_type || !content) {
      return NextResponse.json(
        { error: 'content_type and content are required' },
        { status: 400 }
      );
    }

    // Insert content example
    const { data, error } = await supabase
      .from('brand_content_examples')
      .insert({
        brand_id: brandId,
        content_type,
        platform: platform || null,
        content,
        embedding: embedding || null,
        performance_score: performance_score || 0,
        engagement_metrics: engagement_metrics || null,
        content_metadata: content_metadata || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Failed to create content example:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Content creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create content example' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if ((brand as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const platform = searchParams.get('platform');
    const content_type = searchParams.get('content_type');

    // Build query
    let query = supabase
      .from('brand_content_examples')
      .select('*')
      .eq('brand_id', brandId);

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (content_type) {
      query = query.eq('content_type', content_type);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch content examples:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Content fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content examples' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get content ID from query params
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership through brand
    const { data: content, error: contentError } = await supabase
      .from('brand_content_examples')
      .select('*, brands!inner(user_id)')
      .eq('id', contentId)
      .eq('brand_id', brandId)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if ((content as any).brands.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the content example
    const { error } = await supabase
      .from('brand_content_examples')
      .delete()
      .eq('id', contentId);

    if (error) {
      console.error('Failed to delete content example:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Content deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete content example' },
      { status: 500 }
    );
  }
}