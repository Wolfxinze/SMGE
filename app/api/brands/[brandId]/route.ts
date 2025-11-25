import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // FIX for Critical Issue #3: Use correct table names
    const { data: brand, error } = await supabase
      .from('brands')
      .select(`
        *,
        brand_voice (*),
        target_audiences (*),
        brand_guidelines (*),
        brand_content_examples (*)
      `)
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (error || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Brand fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if ((existing as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, website_url, industry, primary_color, secondary_color, is_active } = body;

    // Update brand
    const { data: brand, error } = await supabase
      .from('brands')
      .update({
        name,
        description,
        website_url,
        industry,
        primary_color,
        secondary_color,
        is_active,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Brand update error:', error);
    return NextResponse.json(
      { error: 'Failed to update brand' },
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
    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if ((existing as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('brands')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', brandId);

    if (error) {
      console.error('Failed to delete brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Brand deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete brand' },
      { status: 500 }
    );
  }
}