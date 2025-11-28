-- ============================================================================
-- SECURITY FIX: Profile Privilege Escalation Vulnerability
-- ============================================================================
-- Migration: 00016_fix_profile_privilege_escalation
-- Purpose: Fix critical security vulnerability allowing privilege escalation
-- Issue: #16 - [P0 SECURITY] Privilege Escalation in Migration 00014
-- CVE Impact: Any authenticated user could create profiles with admin roles
-- ============================================================================

-- ============================================================================
-- Step 1: Drop vulnerable RLS policies
-- ============================================================================
-- These policies with WITH CHECK (true) allow ANY authenticated user to insert
-- ANY data, including admin roles and other users' profiles
DROP POLICY IF EXISTS "Triggers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Triggers can insert agencies" ON public.agencies;
DROP POLICY IF EXISTS "Triggers can insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Triggers can insert subscriptions" ON public.subscriptions;

-- ============================================================================
-- Step 2: Create SECURITY DEFINER function for safe profile creation
-- ============================================================================
-- This function enforces ownership validation and safe defaults
CREATE OR REPLACE FUNCTION public.create_user_profile(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_agency_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Critical security check: NULL user_id is always invalid
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id cannot be NULL';
    END IF;

    -- Critical security check: User can only create their own profile
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Users can only create their own profile';
    END IF;

    -- Validate email is provided
    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;

    -- If agency_id is provided, validate it exists
    IF p_agency_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.agencies WHERE id = p_agency_id
        ) THEN
            RAISE EXCEPTION 'Invalid agency_id: %', p_agency_id;
        END IF;
    END IF;

    -- Insert profile with safe defaults
    -- IMPORTANT: Role is ALWAYS 'user' for self-created profiles
    -- Agency owners get elevated through proper team_members table
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,  -- Always 'user' for security
        subscription_tier,
        agency_id,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_email,
        p_full_name,
        p_avatar_url,
        'user',  -- Hard-coded to prevent privilege escalation
        'free',  -- Default tier
        p_agency_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW()
    RETURNING id INTO v_profile_id;

    RETURN v_profile_id;
END;
$$;

-- ============================================================================
-- Step 3: Create secure RLS policies
-- ============================================================================

-- Policy for authenticated users to create their own profile ONLY
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);  -- Critical: Must match auth user

-- Policy for authenticated users to view profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        -- Users can see their own profile
        auth.uid() = id
        OR
        -- Users can see profiles in their agency
        agency_id IN (
            SELECT agency_id FROM public.team_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- SECURITY FIX: Role is immutable through regular updates
        -- Role changes must go through dedicated admin functions only
        AND role = OLD.role
    );

-- ============================================================================
-- Step 4: Secure policies for related tables
-- ============================================================================

-- Agencies: Only through proper functions/triggers
DROP POLICY IF EXISTS "System can manage agencies" ON public.agencies;
CREATE POLICY "System can manage agencies"
    ON public.agencies
    FOR ALL
    TO service_role
    USING (true);

-- Team members: Only through invitations or ownership
DROP POLICY IF EXISTS "System can manage team_members" ON public.team_members;
CREATE POLICY "System can manage team_members"
    ON public.team_members
    FOR ALL
    TO service_role
    USING (true);

-- Subscriptions: Only through Stripe webhooks
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;
CREATE POLICY "System can manage subscriptions"
    ON public.subscriptions
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- Step 5: Grant execution permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;

-- ============================================================================
-- Step 6: Add security documentation
-- ============================================================================
COMMENT ON FUNCTION public.create_user_profile IS
'Securely creates user profiles with ownership validation and safe defaults.
Prevents privilege escalation by enforcing auth.uid() = user_id and setting role to "user".
Part of security fix for Issue #16.';

COMMENT ON POLICY "Users can create own profile" ON public.profiles IS
'Ensures users can only create profiles with their own auth.uid().
Critical security policy to prevent privilege escalation.';

COMMENT ON POLICY "Users can update own profile" ON public.profiles IS
'Allows profile updates but makes role field immutable.
SECURITY FIX: Role changes are completely blocked - no escalation OR downgrade.
Role modifications must use dedicated administrative functions only.';

-- ============================================================================
-- Step 7: Audit existing profiles for suspicious activity
-- ============================================================================
-- Create a function to audit profiles (for manual review)
CREATE OR REPLACE FUNCTION public.audit_suspicious_profiles()
RETURNS TABLE (
    profile_id UUID,
    email TEXT,
    role TEXT,
    created_at TIMESTAMPTZ,
    issue TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- Find profiles with admin roles but no corresponding team_member owner record
    SELECT
        p.id,
        p.email,
        p.role,
        p.created_at,
        'Admin role without team ownership'::TEXT as issue
    FROM public.profiles p
    WHERE p.role IN ('admin', 'agency_owner')
    AND NOT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = p.id
        AND tm.role = 'owner'
    )

    UNION ALL

    -- Find profiles created very recently with elevated roles
    SELECT
        p.id,
        p.email,
        p.role,
        p.created_at,
        'Recently created with elevated role'::TEXT as issue
    FROM public.profiles p
    WHERE p.role != 'user'
    AND p.created_at > NOW() - INTERVAL '7 days';
END;
$$;

-- Grant audit function to service role only
GRANT EXECUTE ON FUNCTION public.audit_suspicious_profiles TO service_role;

-- ============================================================================
-- Migration completed successfully
-- Run audit_suspicious_profiles() to check for potential exploitation
-- ============================================================================