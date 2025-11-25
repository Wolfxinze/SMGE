import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, website_url, industry, primary_color, secondary_color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

    // Create the brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert({
        user_id: user.id,
        name,
        description,
        website_url,
        industry,
        primary_color,
        secondary_color,
      } as any)
      .select()
      .single();

    if (brandError) {
      console.error('Failed to create brand:', brandError);
      return NextResponse.json({ error: brandError.message }, { status: 500 });
    }

    // Create empty brand voice entry
    const { error: voiceError } = await supabase
      .from('brand_voice')
      .insert({
        brand_id: (brand as any).id,
      } as any);

    if (voiceError) {
      console.error('Failed to create brand voice:', voiceError);
      // Don't fail the whole operation
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Brand creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch brands:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(brands || []);
  } catch (error) {
    console.error('Brands fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}