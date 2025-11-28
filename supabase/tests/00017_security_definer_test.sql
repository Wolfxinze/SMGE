-- ============================================================================
-- Test Suite for SECURITY DEFINER Functions Security Fix
-- ============================================================================
-- Migration: 00017_fix_security_definer_functions
-- Issue: #17 - Unvalidated SECURITY DEFINER Functions
-- Purpose: Validate NULL handling, search_path protection, and correct behavior
-- ============================================================================

-- Enable testing extensions
CREATE EXTENSION IF NOT EXISTS "pgTAP";

-- Start test transaction (will rollback at end)
BEGIN;

-- ============================================================================
-- SETUP: Create test data
-- ============================================================================
SET LOCAL role = service_role;

-- Create test users
INSERT INTO auth.users (id, email) VALUES
    ('10000000-0000-0000-0000-000000000001', 'owner@test.com'),
    ('10000000-0000-0000-0000-000000000002', 'admin@test.com'),
    ('10000000-0000-0000-0000-000000000003', 'member@test.com'),
    ('10000000-0000-0000-0000-000000000004', 'outsider@test.com');

-- Create test profiles
INSERT INTO public.profiles (id, email, full_name, role) VALUES
    ('10000000-0000-0000-0000-000000000001', 'owner@test.com', 'Test Owner', 'user'),
    ('10000000-0000-0000-0000-000000000002', 'admin@test.com', 'Test Admin', 'user'),
    ('10000000-0000-0000-0000-000000000003', 'member@test.com', 'Test Member', 'user'),
    ('10000000-0000-0000-0000-000000000004', 'outsider@test.com', 'Test Outsider', 'user');

-- Create test agency
INSERT INTO public.agencies (id, owner_id, name, slug) VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Test Agency', 'test-agency-sec');

-- Create test team members
INSERT INTO public.team_members (agency_id, user_id, role, status) VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin', 'active'),
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'member', 'inactive');

-- ============================================================================
-- TEST GROUP 1: NULL Parameter Validation - is_agency_owner
-- ============================================================================

-- Test 1.1: Both parameters NULL
SELECT is(
    public.is_agency_owner(NULL, NULL),
    FALSE,
    'is_agency_owner: Should return FALSE when both parameters are NULL'
);

-- Test 1.2: Agency ID NULL, User ID valid
SELECT is(
    public.is_agency_owner(NULL, '10000000-0000-0000-0000-000000000001'::UUID),
    FALSE,
    'is_agency_owner: Should return FALSE when agency_id is NULL'
);

-- Test 1.3: Agency ID valid, User ID NULL
SELECT is(
    public.is_agency_owner('20000000-0000-0000-0000-000000000001'::UUID, NULL),
    FALSE,
    'is_agency_owner: Should return FALSE when user_id is NULL'
);

-- ============================================================================
-- TEST GROUP 2: NULL Parameter Validation - is_team_member_with_role
-- ============================================================================

-- Test 2.1: All parameters NULL
SELECT is(
    public.is_team_member_with_role(NULL, NULL, NULL),
    FALSE,
    'is_team_member_with_role: Should return FALSE when all parameters are NULL'
);

-- Test 2.2: Agency ID NULL
SELECT is(
    public.is_team_member_with_role(NULL, '10000000-0000-0000-0000-000000000001'::UUID, ARRAY['owner']),
    FALSE,
    'is_team_member_with_role: Should return FALSE when agency_id is NULL'
);

-- Test 2.3: User ID NULL
SELECT is(
    public.is_team_member_with_role('20000000-0000-0000-0000-000000000001'::UUID, NULL, ARRAY['owner']),
    FALSE,
    'is_team_member_with_role: Should return FALSE when user_id is NULL'
);

-- Test 2.4: Roles array NULL
SELECT is(
    public.is_team_member_with_role('20000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, NULL),
    FALSE,
    'is_team_member_with_role: Should return FALSE when roles array is NULL'
);

-- Test 2.5: Empty roles array
SELECT is(
    public.is_team_member_with_role('20000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, ARRAY[]::TEXT[]),
    FALSE,
    'is_team_member_with_role: Should return FALSE when roles array is empty'
);

-- ============================================================================
-- TEST GROUP 3: NULL Parameter Validation - is_active_team_member
-- ============================================================================

-- Test 3.1: Both parameters NULL
SELECT is(
    public.is_active_team_member(NULL, NULL),
    FALSE,
    'is_active_team_member: Should return FALSE when both parameters are NULL'
);

-- Test 3.2: Agency ID NULL
SELECT is(
    public.is_active_team_member(NULL, '10000000-0000-0000-0000-000000000001'::UUID),
    FALSE,
    'is_active_team_member: Should return FALSE when agency_id is NULL'
);

-- Test 3.3: User ID NULL
SELECT is(
    public.is_active_team_member('20000000-0000-0000-0000-000000000001'::UUID, NULL),
    FALSE,
    'is_active_team_member: Should return FALSE when user_id is NULL'
);

-- ============================================================================
-- TEST GROUP 4: Search Path Attack Prevention - is_agency_owner
-- ============================================================================

-- Test 4.1: Create malicious schema and shadow table
DO $$
BEGIN
    -- Create attacker schema
    CREATE SCHEMA IF NOT EXISTS attacker_schema_17;

    -- Create malicious agencies table that shadows public.agencies
    CREATE TABLE attacker_schema_17.agencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID DEFAULT gen_random_uuid()
    );

    -- Insert malicious data that would return TRUE if search_path isn't locked
    INSERT INTO attacker_schema_17.agencies (id, owner_id) VALUES
        ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');
END;
$$;

-- Test 4.2: Set malicious search_path
SET LOCAL search_path = attacker_schema_17, public;

-- Test 4.3: Verify function ignores attacker schema despite search_path
SELECT is(
    public.is_agency_owner(
        '30000000-0000-0000-0000-000000000001'::UUID,
        '30000000-0000-0000-0000-000000000002'::UUID
    ),
    FALSE,
    'is_agency_owner: Should ignore attacker schema due to SET search_path = public'
);

-- Test 4.4: Verify function still works with real data after search_path attack
SELECT is(
    public.is_agency_owner(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    TRUE,
    'is_agency_owner: Should still return TRUE for valid owner despite malicious search_path'
);

-- Reset search_path
RESET search_path;

-- ============================================================================
-- TEST GROUP 5: Search Path Attack Prevention - is_team_member_with_role
-- ============================================================================

-- Test 5.1: Create malicious team_members table
DO $$
BEGIN
    -- Create malicious team_members table in attacker schema
    CREATE TABLE IF NOT EXISTS attacker_schema_17.team_members (
        agency_id UUID,
        user_id UUID,
        role TEXT,
        status TEXT DEFAULT 'active'
    );

    -- Insert malicious data
    INSERT INTO attacker_schema_17.team_members (agency_id, user_id, role, status) VALUES
        ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'owner', 'active');
END;
$$;

-- Test 5.2: Set malicious search_path
SET LOCAL search_path = attacker_schema_17, public;

-- Test 5.3: Verify function ignores attacker schema
SELECT is(
    public.is_team_member_with_role(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '40000000-0000-0000-0000-000000000002'::UUID,
        ARRAY['owner']
    ),
    FALSE,
    'is_team_member_with_role: Should ignore attacker schema due to SET search_path = public'
);

-- Test 5.4: Verify function still works with real data
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        ARRAY['owner', 'admin']
    ),
    TRUE,
    'is_team_member_with_role: Should still return TRUE for valid role despite malicious search_path'
);

-- Reset search_path
RESET search_path;

-- ============================================================================
-- TEST GROUP 6: Search Path Attack Prevention - is_active_team_member
-- ============================================================================

-- Test 6.1: Set malicious search_path (reuse attacker_schema_17.team_members)
SET LOCAL search_path = attacker_schema_17, public;

-- Test 6.2: Verify function ignores attacker schema
SELECT is(
    public.is_active_team_member(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '40000000-0000-0000-0000-000000000002'::UUID
    ),
    FALSE,
    'is_active_team_member: Should ignore attacker schema due to SET search_path = public'
);

-- Test 6.3: Verify function still works with real data
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    TRUE,
    'is_active_team_member: Should still return TRUE for active member despite malicious search_path'
);

-- Reset search_path
RESET search_path;

-- ============================================================================
-- TEST GROUP 7: Valid Parameter Tests - is_agency_owner
-- ============================================================================

-- Test 7.1: Valid owner
SELECT is(
    public.is_agency_owner(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    TRUE,
    'is_agency_owner: Should return TRUE for valid owner'
);

-- Test 7.2: Non-owner user
SELECT is(
    public.is_agency_owner(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID
    ),
    FALSE,
    'is_agency_owner: Should return FALSE for non-owner user'
);

-- Test 7.3: Non-existent agency
SELECT is(
    public.is_agency_owner(
        '99999999-9999-9999-9999-999999999999'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    FALSE,
    'is_agency_owner: Should return FALSE for non-existent agency'
);

-- Test 7.4: Non-existent user
SELECT is(
    public.is_agency_owner(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '99999999-9999-9999-9999-999999999999'::UUID
    ),
    FALSE,
    'is_agency_owner: Should return FALSE for non-existent user'
);

-- ============================================================================
-- TEST GROUP 8: Valid Parameter Tests - is_team_member_with_role
-- ============================================================================

-- Test 8.1: Active member with matching role (owner)
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        ARRAY['owner']
    ),
    TRUE,
    'is_team_member_with_role: Should return TRUE for active owner with owner role'
);

-- Test 8.2: Active member with matching role (admin)
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        ARRAY['admin']
    ),
    TRUE,
    'is_team_member_with_role: Should return TRUE for active admin with admin role'
);

-- Test 8.3: Active member with multiple roles (should match admin)
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        ARRAY['owner', 'admin', 'member']
    ),
    TRUE,
    'is_team_member_with_role: Should return TRUE when role matches any in array'
);

-- Test 8.4: Active member with non-matching role
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        ARRAY['owner']
    ),
    FALSE,
    'is_team_member_with_role: Should return FALSE when role does not match'
);

-- Test 8.5: Inactive member (should return FALSE even if role matches)
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000003'::UUID,
        ARRAY['member']
    ),
    FALSE,
    'is_team_member_with_role: Should return FALSE for inactive member even if role matches'
);

-- Test 8.6: Non-member user
SELECT is(
    public.is_team_member_with_role(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID,
        ARRAY['owner', 'admin', 'member']
    ),
    FALSE,
    'is_team_member_with_role: Should return FALSE for non-member user'
);

-- Test 8.7: Non-existent agency
SELECT is(
    public.is_team_member_with_role(
        '99999999-9999-9999-9999-999999999999'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        ARRAY['owner']
    ),
    FALSE,
    'is_team_member_with_role: Should return FALSE for non-existent agency'
);

-- ============================================================================
-- TEST GROUP 9: Valid Parameter Tests - is_active_team_member
-- ============================================================================

-- Test 9.1: Active member (owner)
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    TRUE,
    'is_active_team_member: Should return TRUE for active owner'
);

-- Test 9.2: Active member (admin)
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID
    ),
    TRUE,
    'is_active_team_member: Should return TRUE for active admin'
);

-- Test 9.3: Inactive member
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000003'::UUID
    ),
    FALSE,
    'is_active_team_member: Should return FALSE for inactive member'
);

-- Test 9.4: Non-member user
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID
    ),
    FALSE,
    'is_active_team_member: Should return FALSE for non-member user'
);

-- Test 9.5: Non-existent agency
SELECT is(
    public.is_active_team_member(
        '99999999-9999-9999-9999-999999999999'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID
    ),
    FALSE,
    'is_active_team_member: Should return FALSE for non-existent agency'
);

-- Test 9.6: Non-existent user
SELECT is(
    public.is_active_team_member(
        '20000000-0000-0000-0000-000000000001'::UUID,
        '99999999-9999-9999-9999-999999999999'::UUID
    ),
    FALSE,
    'is_active_team_member: Should return FALSE for non-existent user'
);

-- ============================================================================
-- TEST GROUP 10: Schema Qualification Verification
-- ============================================================================

-- Test 10.1: Verify functions use explicit public schema references
SELECT is(
    (SELECT routine_schema FROM information_schema.routines
     WHERE routine_name = 'is_agency_owner' AND routine_schema = 'public'),
    'public',
    'is_agency_owner: Function should be in public schema'
);

SELECT is(
    (SELECT routine_schema FROM information_schema.routines
     WHERE routine_name = 'is_team_member_with_role' AND routine_schema = 'public'),
    'public',
    'is_team_member_with_role: Function should be in public schema'
);

SELECT is(
    (SELECT routine_schema FROM information_schema.routines
     WHERE routine_name = 'is_active_team_member' AND routine_schema = 'public'),
    'public',
    'is_active_team_member: Function should be in public schema'
);

-- Test 10.2: Verify SECURITY DEFINER is set
SELECT ok(
    prosecdef,
    'is_agency_owner: Should have SECURITY DEFINER set'
)
FROM pg_proc
WHERE proname = 'is_agency_owner'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT ok(
    prosecdef,
    'is_team_member_with_role: Should have SECURITY DEFINER set'
)
FROM pg_proc
WHERE proname = 'is_team_member_with_role'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT ok(
    prosecdef,
    'is_active_team_member: Should have SECURITY DEFINER set'
)
FROM pg_proc
WHERE proname = 'is_active_team_member'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- CLEANUP: Drop attacker schema
-- ============================================================================
DROP SCHEMA IF EXISTS attacker_schema_17 CASCADE;

-- ============================================================================
-- Test Summary
-- ============================================================================
SELECT * FROM finish();

-- Rollback test data
ROLLBACK;
