-- ============================================================================
-- FIX: Team Members RLS Infinite Recursion
-- ============================================================================
-- Migration: 00015_fix_team_members_rls_recursion
-- Issue: Infinite recursion in team_members RLS policies
-- Root Cause: Policies checking team_members table while evaluating team_members access
--
-- Solution: Use SECURITY DEFINER functions to bypass RLS during permission checks
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view team members in their agencies" ON public.team_members;
DROP POLICY IF EXISTS "Admins can invite team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can remove team members" ON public.team_members;

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================
-- These functions bypass RLS to check permissions without recursion

-- Drop existing functions if they exist (with all possible signatures)
DROP FUNCTION IF EXISTS public.is_agency_owner(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member_with_role(UUID, UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.is_active_team_member(UUID, UUID);

-- Check if user is agency owner
CREATE FUNCTION public.is_agency_owner(p_agency_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.agencies
        WHERE id = p_agency_id
        AND owner_id = p_user_id
    );
END;
$$;

-- Check if user is active team member with specific role
CREATE FUNCTION public.is_team_member_with_role(
    p_agency_id UUID,
    p_user_id UUID,
    p_roles TEXT[]
)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE agency_id = p_agency_id
        AND user_id = p_user_id
        AND status = 'active'
        AND role = ANY(p_roles)
    );
END;
$$;

-- Check if user is any active team member
CREATE FUNCTION public.is_active_team_member(
    p_agency_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE agency_id = p_agency_id
        AND user_id = p_user_id
        AND status = 'active'
    );
END;
$$;

-- ============================================================================
-- FIXED RLS POLICIES FOR TEAM_MEMBERS
-- ============================================================================

-- Team members can view other members in their agency
CREATE POLICY "Users can view team members in their agencies"
    ON public.team_members FOR SELECT
    USING (
        public.is_agency_owner(team_members.agency_id, auth.uid())
        OR public.is_active_team_member(team_members.agency_id, auth.uid())
    );

-- Only owners and admins can invite team members
CREATE POLICY "Admins can invite team members"
    ON public.team_members FOR INSERT
    WITH CHECK (
        public.is_agency_owner(team_members.agency_id, auth.uid())
        OR public.is_team_member_with_role(
            team_members.agency_id,
            auth.uid(),
            ARRAY['owner', 'admin']
        )
    );

-- Owners and admins can update team members, users can update their own record
CREATE POLICY "Admins can update team members"
    ON public.team_members FOR UPDATE
    USING (
        -- Can update if you're owner or admin
        public.is_agency_owner(team_members.agency_id, auth.uid())
        OR public.is_team_member_with_role(
            team_members.agency_id,
            auth.uid(),
            ARRAY['owner', 'admin']
        )
        -- Or if you're updating your own record (accepting invitation)
        OR user_id = auth.uid()
    )
    WITH CHECK (
        -- Cannot change owner role unless you are the agency owner
        (team_members.role != 'owner' OR public.is_agency_owner(team_members.agency_id, auth.uid()))
    );

-- Owners and admins can remove team members (cannot remove owner)
CREATE POLICY "Admins can remove team members"
    ON public.team_members FOR DELETE
    USING (
        (
            public.is_agency_owner(team_members.agency_id, auth.uid())
            OR public.is_team_member_with_role(
                team_members.agency_id,
                auth.uid(),
                ARRAY['owner', 'admin']
            )
        )
        -- Cannot remove owner
        AND team_members.role != 'owner'
    );

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_agency_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member_with_role(UUID, UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(UUID, UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.is_agency_owner(UUID, UUID) IS 'Check if user owns an agency (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION public.is_team_member_with_role(UUID, UUID, TEXT[]) IS 'Check if user has specific role in agency (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION public.is_active_team_member(UUID, UUID) IS 'Check if user is active member of agency (SECURITY DEFINER to bypass RLS)';
