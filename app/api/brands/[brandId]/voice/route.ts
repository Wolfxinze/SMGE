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

    // Get brand voice
    const { data: voice, error } = await supabase
      .from('brand_voice')
      .select('*')
      .eq('brand_id', brandId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to fetch brand voice:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(voice || {});
  } catch (error) {
    console.error('Voice fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand voice' },
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
      tone,
      writing_style,
      communication_preferences,
      keywords,
      avoid_phrases,
      content_themes,
      brand_values,
      unique_selling_points,
    } = body;

    // Check if voice exists
    const { data: existing } = await supabase
      .from('brand_voice')
      .select('id')
      .eq('brand_id', brandId)
      .single();

    let voice;
    if (existing) {
      // Update existing voice
      const { data, error } = await (supabase
        .from('brand_voice') as any)
        .update({
          tone,
          writing_style,
          communication_preferences,
          keywords,
          avoid_phrases,
          content_themes,
          brand_values,
          unique_selling_points,
          updated_at: new Date().toISOString(),
        })
        .eq('brand_id', brandId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update brand voice:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      voice = data;
    } else {
      // Create new voice
      const { data, error } = await supabase
        .from('brand_voice')
        .insert({
          brand_id: brandId,
          tone,
          writing_style,
          communication_preferences,
          keywords,
          avoid_phrases,
          content_themes,
          brand_values,
          unique_selling_points,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Failed to create brand voice:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      voice = data;
    }

    return NextResponse.json(voice);
  } catch (error) {
    console.error('Voice update error:', error);
    return NextResponse.json(
      { error: 'Failed to update brand voice' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { voice_embedding } = body;

    if (!voice_embedding || !Array.isArray(voice_embedding)) {
      return NextResponse.json(
        { error: 'voice_embedding must be an array' },
        { status: 400 }
      );
    }

    // Update voice embedding
    const { data, error } = await (supabase
      .from('brand_voice') as any)
      .update({
        voice_embedding,
        embedding_version: 1,
        last_trained_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update voice embedding:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Voice embedding update error:', error);
    return NextResponse.json(
      { error: 'Failed to update voice embedding' },
      { status: 500 }
    );
  }
}