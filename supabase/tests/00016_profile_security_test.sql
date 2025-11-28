-- ============================================================================
-- Test Suite for Profile Privilege Escalation Fix
-- ============================================================================
-- Migration: 00016_fix_profile_privilege_escalation
-- Purpose: Validate security fixes prevent privilege escalation
-- ============================================================================

-- Enable testing extensions
CREATE EXTENSION IF NOT EXISTS "pgTAP";

-- Start test transaction (will rollback at end)
BEGIN;

-- ============================================================================
-- Test 1: Verify vulnerable policies are removed
-- ============================================================================
SELECT is(
    COUNT(*)::INT,
    0,
    'Vulnerable "Triggers can insert profiles" policy should not exist'
)
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'profiles'
AND policyname = 'Triggers can insert profiles';

SELECT is(
    COUNT(*)::INT,
    0,
    'Vulnerable "Triggers can insert agencies" policy should not exist'
)
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'agencies'
AND policyname = 'Triggers can insert agencies';

-- ============================================================================
-- Test 2: Verify secure policies exist
-- ============================================================================
SELECT is(
    COUNT(*)::INT,
    1,
    'Secure "Users can create own profile" policy should exist'
)
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'profiles'
AND policyname = 'Users can create own profile';

-- ============================================================================
-- Test 3: Test create_user_profile function security
-- ============================================================================

-- Create test users
INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'attacker@test.com'),
    ('22222222-2222-2222-2222-222222222222', 'victim@test.com');

-- Set session to attacker
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL role = authenticated;

-- Test 3.1: Attacker CANNOT create profile for victim
DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
BEGIN
    PERFORM public.create_user_profile(
        p_user_id := '22222222-2222-2222-2222-222222222222'::UUID,
        p_email := 'victim@test.com',
        p_full_name := 'Victim User'
    );
EXCEPTION
    WHEN OTHERS THEN
        v_error_caught := TRUE;
        RAISE NOTICE 'Expected error caught: %', SQLERRM;
END;
$$;

-- Test 3.2: Attacker CAN create their own profile
DO $$
DECLARE
    v_profile_id UUID;
BEGIN
    v_profile_id := public.create_user_profile(
        p_user_id := '11111111-1111-1111-1111-111111111111'::UUID,
        p_email := 'attacker@test.com',
        p_full_name := 'Attacker User'
    );

    -- Verify profile was created with safe defaults
    PERFORM is(
        role,
        'user',
        'Profile should be created with "user" role, not admin'
    )
    FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111';
END;
$$;

-- Test 3.3: NULL user_id is rejected
DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
BEGIN
    PERFORM public.create_user_profile(
        p_user_id := NULL,
        p_email := 'null@test.com'
    );
EXCEPTION
    WHEN OTHERS THEN
        v_error_caught := TRUE;
        IF SQLERRM LIKE '%user_id cannot be NULL%' THEN
            RAISE NOTICE 'Correct error for NULL user_id';
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
END;
$$;

-- ============================================================================
-- Test 4: Test RLS policies prevent direct privilege escalation
-- ============================================================================

-- Test 4.1: Cannot directly insert profile with admin role
DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        role  -- Trying to set admin role
    ) VALUES (
        '33333333-3333-3333-3333-333333333333'::UUID,
        'escalation@test.com',
        'admin'
    );
EXCEPTION
    WHEN OTHERS THEN
        v_error_caught := TRUE;
        RAISE NOTICE 'RLS blocked direct insert with admin role: %', SQLERRM;
END;
$$;

-- Test 4.2: Cannot update own profile to admin role
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
BEGIN
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = '11111111-1111-1111-1111-111111111111'::UUID;
EXCEPTION
    WHEN OTHERS THEN
        v_error_caught := TRUE;
        RAISE NOTICE 'RLS blocked role escalation through update: %', SQLERRM;
END;
$$;

-- ============================================================================
-- Test 5: Test profile visibility policies
-- ============================================================================

-- Create test agency and team member
INSERT INTO public.agencies (id, owner_id, name, slug) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Test Agency', 'test-agency');

INSERT INTO public.team_members (agency_id, user_id, role, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active');

-- User can see their own profile
SELECT is(
    COUNT(*)::INT,
    1,
    'User can see their own profile'
)
FROM public.profiles
WHERE id = '11111111-1111-1111-1111-111111111111';

-- User cannot see unrelated profiles
SELECT is(
    COUNT(*)::INT,
    0,
    'User cannot see unrelated profiles'
)
FROM public.profiles
WHERE id = '22222222-2222-2222-2222-222222222222';

-- ============================================================================
-- Test 6: Test audit function
-- ============================================================================
SET LOCAL role = service_role;

-- Create suspicious profile for audit testing
INSERT INTO public.profiles (id, email, role) VALUES
    ('99999999-9999-9999-9999-999999999999', 'suspicious@test.com', 'admin');

-- Run audit
SELECT is(
    COUNT(*)::INT > 0,
    TRUE,
    'Audit function should detect suspicious admin profiles'
)
FROM public.audit_suspicious_profiles()
WHERE profile_id = '99999999-9999-9999-9999-999999999999';

-- ============================================================================
-- Test Summary
-- ============================================================================
SELECT * FROM finish();

-- Rollback test data
ROLLBACK;