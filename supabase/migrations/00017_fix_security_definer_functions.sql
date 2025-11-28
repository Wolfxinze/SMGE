-- ============================================================================
-- FIX: SECURITY DEFINER Functions Vulnerability
-- ============================================================================
-- Migration: 00017_fix_security_definer_functions
-- Issue: #17 - Unvalidated SECURITY DEFINER Functions
-- Root Cause: Missing NULL validation and search_path protection
--
-- Security Fixes:
-- 1. Add SET search_path = public to prevent search_path attacks
-- 2. Add NULL parameter validation
-- 3. Return FALSE for any NULL inputs
-- ============================================================================

-- ============================================================================
-- RECREATE FUNCTIONS WITH SECURITY FIXES
-- ============================================================================

-- Fix: is_agency_owner function
CREATE OR REPLACE FUNCTION public.is_agency_owner(
    p_agency_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path to prevent attacks
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs - return FALSE for NULL parameters
    IF p_agency_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check ownership with explicit schema qualification
    RETURN EXISTS (
        SELECT 1 FROM public.agencies
        WHERE id = p_agency_id
        AND owner_id = p_user_id
    );
END;
$$;

-- Fix: is_team_member_with_role function
CREATE OR REPLACE FUNCTION public.is_team_member_with_role(
    p_agency_id UUID,
    p_user_id UUID,
    p_roles TEXT[]
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path to prevent attacks
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs - return FALSE for NULL parameters
    IF p_agency_id IS NULL OR p_user_id IS NULL OR p_roles IS NULL THEN
        RETURN FALSE;
    END IF;

    -- ✅ Additional check for empty roles array
    IF array_length(p_roles, 1) IS NULL OR array_length(p_roles, 1) = 0 THEN
        RETURN FALSE;
    END IF;

    -- Check team membership with explicit schema qualification
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE agency_id = p_agency_id
        AND user_id = p_user_id
        AND status = 'active'
        AND role = ANY(p_roles)
    );
END;
$$;

-- Fix: is_active_team_member function
CREATE OR REPLACE FUNCTION public.is_active_team_member(
    p_agency_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public  -- ✅ Lock down search path to prevent attacks
LANGUAGE plpgsql
AS $$
BEGIN
    -- ✅ Validate inputs - return FALSE for NULL parameters
    IF p_agency_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check active membership with explicit schema qualification
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE agency_id = p_agency_id
        AND user_id = p_user_id
        AND status = 'active'
    );
END;
$$;

-- ============================================================================
-- SECURITY DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.is_agency_owner(UUID, UUID) IS
'Check if user owns an agency. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.is_team_member_with_role(UUID, UUID, TEXT[]) IS
'Check if user has specific role in agency. SECURITY DEFINER with search_path protection and NULL validation.';

COMMENT ON FUNCTION public.is_active_team_member(UUID, UUID) IS
'Check if user is active member of agency. SECURITY DEFINER with search_path protection and NULL validation.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test NULL handling (should all return FALSE)
DO $$
DECLARE
    test_result BOOLEAN;
BEGIN
    -- Test is_agency_owner with NULLs
    test_result := public.is_agency_owner(NULL, NULL);
    IF test_result IS NOT FALSE THEN
        RAISE EXCEPTION 'is_agency_owner NULL check failed: expected FALSE, got %', test_result;
    END IF;

    -- Test is_team_member_with_role with NULLs
    test_result := public.is_team_member_with_role(NULL, NULL, NULL);
    IF test_result IS NOT FALSE THEN
        RAISE EXCEPTION 'is_team_member_with_role NULL check failed: expected FALSE, got %', test_result;
    END IF;

    -- Test is_active_team_member with NULLs
    test_result := public.is_active_team_member(NULL, NULL);
    IF test_result IS NOT FALSE THEN
        RAISE EXCEPTION 'is_active_team_member NULL check failed: expected FALSE, got %', test_result;
    END IF;

    RAISE NOTICE 'All SECURITY DEFINER functions validated successfully';
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================