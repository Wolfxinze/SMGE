/**
 * API Route: Agency Management
 * Endpoints for managing user's agencies
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/agencies
 * Get all agencies the current user has access to
 */
export async function GET() {
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

    // Get agencies where user is owner or team member
    // Note: 'agencies' table is not yet in generated types - using type assertion
    const { data: agencies, error } = await (supabase as any)
      .from('agencies')
      .select(`
        id,
        name,
        slug,
        branding,
        subscription_tier,
        is_active,
        created_at,
        team_members!inner(role, status)
      `)
      .eq('team_members.user_id', user.id)
      .eq('team_members.status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/agencies error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform response to include user's role
    const agenciesWithRole = agencies?.map((agency: any) => ({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      branding: agency.branding,
      subscription_tier: agency.subscription_tier,
      is_active: agency.is_active,
      created_at: agency.created_at,
      user_role: agency.team_members[0]?.role,
    })) || [];

    return NextResponse.json({ agencies: agenciesWithRole }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/agencies error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
