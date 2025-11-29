-- ============================================================================
-- AGENCY FEATURES TESTING SCENARIOS
-- ============================================================================
-- Purpose: Quick reference SQL for testing agency features
-- Usage: Run individual sections to test specific scenarios
-- Note: Replace UUIDs with actual values from your database
-- ============================================================================

-- ============================================================================
-- SETUP: Get Test Data
-- ============================================================================

-- Get a sample user ID (existing user)
SELECT id, email, full_name
FROM auth.users
LIMIT 1;
-- Copy the ID as: <user-id>

-- Get a sample agency ID (created during migration)
SELECT id, name, owner_id
FROM public.agencies
LIMIT 1;
-- Copy the ID as: <agency-id>

-- Get a sample brand ID
SELECT id, name, agency_id, user_id
FROM public.brands
LIMIT 1;
-- Copy the ID as: <brand-id>

-- ============================================================================
-- SCENARIO 1: Agency Owner Access (Should Work)
-- ============================================================================

-- Simulate agency owner
SET LOCAL jwt.claims.sub = '<owner-user-id>';

-- Owner can view their agency
SELECT * FROM public.agencies WHERE id = '<agency-id>';

-- Owner can view all brands in agency
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';

-- Owner can view team members
SELECT * FROM public.team_members WHERE agency_id = '<agency-id>';

-- Owner can create a new brand
INSERT INTO public.brands (user_id, agency_id, name, tagline)
VALUES ('<owner-user-id>', '<agency-id>', 'Test Brand', 'Testing agency features')
RETURNING id, name;

-- Owner can update agency settings
UPDATE public.agencies
SET settings = '{"test_mode": true}'::jsonb
WHERE id = '<agency-id>'
RETURNING id, settings;

-- ============================================================================
-- SCENARIO 2: Create and Test Admin User
-- ============================================================================

-- First, create a new user (or use existing user ID)
-- In production, this would be done via Supabase Auth
-- For testing, we'll use an existing user as admin

-- Owner invites admin
SET LOCAL jwt.claims.sub = '<owner-user-id>';

INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access,
    accepted_at
)
VALUES (
    '<agency-id>',
    '<admin-user-id>',  -- Different user
    'admin',
    'active',
    '{"type": "all"}'::jsonb,
    NOW()
)
RETURNING id, role, status;

-- Switch to admin user
SET LOCAL jwt.claims.sub = '<admin-user-id>';

-- Admin can view agency
SELECT * FROM public.agencies WHERE id = '<agency-id>';

-- Admin can view brands
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';

-- Admin can create brand
INSERT INTO public.brands (user_id, agency_id, name)
VALUES ('<admin-user-id>', '<agency-id>', 'Admin Test Brand')
RETURNING id, name;

-- Admin can invite editor
INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access
)
VALUES (
    '<agency-id>',
    '<editor-user-id>',
    'editor',
    'active',
    '{"type": "all"}'::jsonb
)
RETURNING id, role;

-- Admin CANNOT change owner settings
UPDATE public.agencies
SET owner_id = '<admin-user-id>'
WHERE id = '<agency-id>';
-- Should fail with RLS violation

-- ============================================================================
-- SCENARIO 3: Create and Test Editor User
-- ============================================================================

-- Owner/Admin invites editor
SET LOCAL jwt.claims.sub = '<owner-user-id>';

INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access,
    accepted_at
)
VALUES (
    '<agency-id>',
    '<editor-user-id>',
    'editor',
    'active',
    '{"type": "all"}'::jsonb,
    NOW()
)
RETURNING id, role;

-- Switch to editor
SET LOCAL jwt.claims.sub = '<editor-user-id>';

-- Editor can view brands
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';

-- Editor can create brand
INSERT INTO public.brands (user_id, agency_id, name)
VALUES ('<editor-user-id>', '<agency-id>', 'Editor Brand')
RETURNING id, name;

-- Editor can create post
INSERT INTO public.posts (user_id, brand_id, content_type, body, status)
VALUES (
    '<editor-user-id>',
    '<brand-id>',
    'post',
    'Test post created by editor',
    'draft'
)
RETURNING id, body;

-- Editor can update own post
UPDATE public.posts
SET body = 'Updated post content'
WHERE user_id = '<editor-user-id>'
RETURNING id, body;

-- Editor CANNOT delete posts
DELETE FROM public.posts WHERE id = '<post-id>';
-- Should delete 0 rows (RLS blocks)

-- Editor CANNOT invite team members
INSERT INTO public.team_members (agency_id, user_id, role, status)
VALUES ('<agency-id>', '<new-user-id>', 'viewer', 'invited');
-- Should fail with RLS violation

-- ============================================================================
-- SCENARIO 4: Create and Test Viewer User (Read-Only)
-- ============================================================================

-- Owner/Admin invites viewer
SET LOCAL jwt.claims.sub = '<owner-user-id>';

INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access,
    accepted_at
)
VALUES (
    '<agency-id>',
    '<viewer-user-id>',
    'viewer',
    'active',
    '{"type": "all"}'::jsonb,
    NOW()
)
RETURNING id, role;

-- Switch to viewer
SET LOCAL jwt.claims.sub = '<viewer-user-id>';

-- Viewer can view brands
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';

-- Viewer can view posts
SELECT * FROM public.posts WHERE brand_id = '<brand-id>';

-- Viewer CANNOT create brand
INSERT INTO public.brands (user_id, agency_id, name)
VALUES ('<viewer-user-id>', '<agency-id>', 'Viewer Brand');
-- Should fail with RLS violation

-- Viewer CANNOT create post
INSERT INTO public.posts (user_id, brand_id, content_type, body)
VALUES ('<viewer-user-id>', '<brand-id>', 'post', 'Test');
-- Should fail with RLS violation

-- Viewer CANNOT update brand
UPDATE public.brands SET name = 'Hacked' WHERE id = '<brand-id>';
-- Should update 0 rows (RLS blocks)

-- ============================================================================
-- SCENARIO 5: Specific Brand Access (Editor)
-- ============================================================================

-- Create editor with access to ONLY specific brands
SET LOCAL jwt.claims.sub = '<owner-user-id>';

INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access,
    accepted_at
)
VALUES (
    '<agency-id>',
    '<restricted-editor-id>',
    'editor',
    'active',
    '{"type": "specific", "brand_ids": ["<brand-1-id>", "<brand-2-id>"]}'::jsonb,
    NOW()
)
RETURNING id, role, brand_access;

-- Switch to restricted editor
SET LOCAL jwt.claims.sub = '<restricted-editor-id>';

-- Can ONLY see assigned brands
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
-- Should return only brand-1 and brand-2

-- Can create post for assigned brand
INSERT INTO public.posts (user_id, brand_id, content_type, body)
VALUES ('<restricted-editor-id>', '<brand-1-id>', 'post', 'Test')
RETURNING id;

-- CANNOT create post for non-assigned brand
INSERT INTO public.posts (user_id, brand_id, content_type, body)
VALUES ('<restricted-editor-id>', '<brand-3-id>', 'post', 'Test');
-- Should fail with RLS violation

-- ============================================================================
-- SCENARIO 6: Brand-Level Permission Override
-- ============================================================================

-- Admin creates brand-level permission override
SET LOCAL jwt.claims.sub = '<admin-user-id>';

-- Get team_member_id for the editor
SELECT id FROM public.team_members
WHERE agency_id = '<agency-id>' AND user_id = '<editor-user-id>';
-- Copy as: <editor-team-member-id>

-- Remove publish permission for specific brand
INSERT INTO public.brand_members (
    brand_id,
    team_member_id,
    permissions,
    granted_by
)
VALUES (
    '<brand-id>',
    '<editor-team-member-id>',
    '{"can_view": true, "can_edit_posts": true, "can_publish": false, "can_delete": false}'::jsonb,
    '<admin-user-id>'
)
RETURNING id, permissions;

-- Switch to editor
SET LOCAL jwt.claims.sub = '<editor-user-id>';

-- Editor can still create draft
INSERT INTO public.posts (user_id, brand_id, content_type, body, status)
VALUES ('<editor-user-id>', '<brand-id>', 'post', 'Draft post', 'draft')
RETURNING id, status;

-- But check permission shows cannot publish
SELECT public.check_brand_permission(
    '<editor-user-id>',
    '<brand-id>',
    'can_publish'
);
-- Should return false

-- ============================================================================
-- SCENARIO 7: Team Invitation Workflow
-- ============================================================================

-- Admin creates invitation
SET LOCAL jwt.claims.sub = '<admin-user-id>';

INSERT INTO public.team_invitations (
    agency_id,
    email,
    role,
    brand_access,
    invited_by
)
VALUES (
    '<agency-id>',
    'newuser@example.com',
    'editor',
    '{"type": "all"}'::jsonb,
    '<admin-user-id>'
)
RETURNING id, invitation_token, expires_at;
-- Copy invitation_token as: <invitation-token>

-- View pending invitations
SELECT email, role, status, expires_at
FROM public.team_invitations
WHERE agency_id = '<agency-id>' AND status = 'pending';

-- Accept invitation (would be done via API in production)
UPDATE public.team_invitations
SET status = 'accepted', accepted_at = NOW()
WHERE invitation_token = '<invitation-token>'
RETURNING id, status;

-- Create team_member from accepted invitation
INSERT INTO public.team_members (
    agency_id,
    user_id,
    role,
    status,
    brand_access,
    invited_by,
    accepted_at
)
SELECT
    agency_id,
    '<new-user-id>',  -- User created via Supabase Auth
    role,
    'active',
    brand_access,
    invited_by,
    NOW()
FROM public.team_invitations
WHERE invitation_token = '<invitation-token>'
RETURNING id, role, status;

-- ============================================================================
-- SCENARIO 8: Activity Logging
-- ============================================================================

-- Log a brand creation
SET LOCAL jwt.claims.sub = '<admin-user-id>';

SELECT public.log_activity(
    '<agency-id>',
    'brand.created',
    'brand',
    '<brand-id>',
    '<brand-id>',
    '{"brand_name": "New Brand", "created_by": "Admin User"}'::jsonb
);

-- Log a post published
SELECT public.log_activity(
    '<agency-id>',
    'post.published',
    'post',
    '<post-id>',
    '<brand-id>',
    '{"post_title": "Test Post", "platforms": ["instagram", "twitter"]}'::jsonb
);

-- View activity logs (admin only)
SELECT
    action,
    entity_type,
    metadata->>'brand_name' as brand_name,
    created_at
FROM public.activity_logs
WHERE agency_id = '<agency-id>'
ORDER BY created_at DESC
LIMIT 10;

-- Viewer cannot see activity logs
SET LOCAL jwt.claims.sub = '<viewer-user-id>';
SELECT COUNT(*) FROM public.activity_logs WHERE agency_id = '<agency-id>';
-- Should return 0 (RLS blocks)

-- ============================================================================
-- SCENARIO 9: Helper Functions Testing
-- ============================================================================

-- Test is_agency_owner
SET LOCAL jwt.claims.sub = '<owner-user-id>';
SELECT public.is_agency_owner('<agency-id>');
-- Should return true

SET LOCAL jwt.claims.sub = '<admin-user-id>';
SELECT public.is_agency_owner('<agency-id>');
-- Should return false

-- Test is_agency_admin
SET LOCAL jwt.claims.sub = '<owner-user-id>';
SELECT public.is_agency_admin('<agency-id>');
-- Should return true (owner is also admin)

SET LOCAL jwt.claims.sub = '<admin-user-id>';
SELECT public.is_agency_admin('<agency-id>');
-- Should return true

SET LOCAL jwt.claims.sub = '<editor-user-id>';
SELECT public.is_agency_admin('<agency-id>');
-- Should return false

-- Test get_user_brands
SET LOCAL jwt.claims.sub = '<editor-user-id>';
SELECT * FROM public.get_user_brands('<agency-id>');
-- Should return all accessible brands with permissions

-- Test can_access_brand
SELECT public.can_access_brand('<brand-id>');
-- Should return true if user has access

-- Test check_brand_permission
SELECT public.check_brand_permission(
    '<editor-user-id>',
    '<brand-id>',
    'can_edit_posts'
);
-- Should return true

SELECT public.check_brand_permission(
    '<editor-user-id>',
    '<brand-id>',
    'can_delete'
);
-- Should return false (editors cannot delete)

-- ============================================================================
-- SCENARIO 10: Cross-Tenant Isolation (Security Test)
-- ============================================================================

-- Create second agency
SET LOCAL jwt.claims.sub = '<user-2-id>';

INSERT INTO public.agencies (owner_id, name, slug)
VALUES ('<user-2-id>', 'Agency 2', 'agency-2')
RETURNING id;
-- Copy as: <agency-2-id>

-- Create brand in agency 2
INSERT INTO public.brands (user_id, agency_id, name)
VALUES ('<user-2-id>', '<agency-2-id>', 'Agency 2 Brand')
RETURNING id;
-- Copy as: <agency-2-brand-id>

-- User from agency 1 CANNOT access agency 2 data
SET LOCAL jwt.claims.sub = '<agency-1-user-id>';

SELECT * FROM public.agencies WHERE id = '<agency-2-id>';
-- Should return 0 rows

SELECT * FROM public.brands WHERE id = '<agency-2-brand-id>';
-- Should return 0 rows

SELECT * FROM public.brands WHERE agency_id = '<agency-2-id>';
-- Should return 0 rows

-- User CANNOT modify agency_id to gain access
UPDATE public.brands
SET agency_id = '<agency-2-id>'
WHERE user_id = '<agency-1-user-id>';
-- Should update 0 rows (RLS blocks)

-- ============================================================================
-- SCENARIO 11: New User Signup Auto-Agency Creation (CRITICAL TEST)
-- ============================================================================

-- Test that new users automatically get a personal agency
-- This prevents FK violations when creating brands

-- Simulate new user signup by inserting profile
-- In production, this would be done via Supabase Auth + trigger
INSERT INTO public.profiles (id, email, full_name, subscription_tier)
VALUES (
    gen_random_uuid(),  -- New user ID
    'newuser@test.com',
    'New Test User',
    'free'
)
RETURNING id;
-- Copy the ID as: <new-user-id>

-- Verify agency was auto-created
SELECT id, name, slug, owner_id
FROM public.agencies
WHERE owner_id = '<new-user-id>';
-- Should return 1 row with name "New Test User's Agency"

-- Verify team_member record was created
SELECT id, role, status
FROM public.team_members
WHERE user_id = '<new-user-id>' AND role = 'owner';
-- Should return 1 row with role='owner', status='active'

-- New user can immediately create brand (no FK violation)
SET LOCAL jwt.claims.sub = '<new-user-id>';

INSERT INTO public.brands (user_id, agency_id, name)
SELECT
    '<new-user-id>',
    a.id,
    'First Brand'
FROM public.agencies a
WHERE a.owner_id = '<new-user-id>'
RETURNING id, name, agency_id;
-- Should succeed without errors

-- Verify permissions were materialized
SELECT can_view, can_edit, can_delete, can_publish
FROM public.user_brand_permissions
WHERE user_id = '<new-user-id>';
-- Should return 1 row with all permissions = true (owner)

-- ============================================================================
-- SCENARIO 12: Materialized Permissions Performance Test
-- ============================================================================

-- Test that permission lookups are fast (O(1) instead of O(N))

-- Create test agency with multiple brands
SET LOCAL jwt.claims.sub = '<owner-user-id>';

-- Insert 100 test brands
INSERT INTO public.brands (user_id, agency_id, name)
SELECT
    '<owner-user-id>',
    '<agency-id>',
    'Test Brand ' || generate_series(1, 100)
RETURNING COUNT(*);

-- Test query performance with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
-- Expected: <50ms with materialized permissions (vs >2000ms with N+1)

-- Verify permission table has entries for all brands
SELECT COUNT(*) FROM public.user_brand_permissions
WHERE user_id = '<owner-user-id>';
-- Should return 100+ (one per brand)

-- Test permission refresh on team member change
INSERT INTO public.team_members (agency_id, user_id, role, status, brand_access)
VALUES (
    '<agency-id>',
    '<new-team-member-id>',
    'editor',
    'active',
    '{"type": "all"}'::jsonb
)
RETURNING id;

-- Verify permissions auto-refreshed
SELECT COUNT(*) FROM public.user_brand_permissions
WHERE user_id = '<new-team-member-id>';
-- Should return 100+ (auto-refreshed by trigger)

-- ============================================================================
-- SCENARIO 13: Performance Testing
-- ============================================================================

-- Test brand list query performance
EXPLAIN ANALYZE
SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
-- Should use idx_brands_agency_id, execution time < 200ms

-- Test permission check performance
EXPLAIN ANALYZE
SELECT public.check_brand_permission(
    '<user-id>',
    '<brand-id>',
    'can_edit_posts'
);
-- Execution time < 50ms

-- Test activity log query performance
EXPLAIN ANALYZE
SELECT * FROM public.activity_logs
WHERE agency_id = '<agency-id>'
ORDER BY created_at DESC
LIMIT 50;
-- Should use idx_activity_logs_created_at, execution time < 300ms

-- ============================================================================
-- CLEANUP: Remove Test Data
-- ============================================================================

-- WARNING: Only run in development environment!

-- Remove test posts
DELETE FROM public.posts WHERE body LIKE '%Test%' OR body LIKE '%test%';

-- Remove test brands
DELETE FROM public.brands WHERE name LIKE '%Test%';

-- Remove test team members (keep owners)
DELETE FROM public.team_members WHERE role != 'owner' AND status = 'invited';

-- Remove test invitations
DELETE FROM public.team_invitations WHERE status IN ('pending', 'expired');

-- Remove test activity logs
DELETE FROM public.activity_logs WHERE action LIKE '%test%';

-- ============================================================================
-- END OF TESTING SCENARIOS
-- ============================================================================

-- Reset session (clear jwt.claims.sub)
RESET ALL;
