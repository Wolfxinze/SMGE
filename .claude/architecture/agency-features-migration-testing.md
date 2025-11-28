# Agency Features Migration Testing Checklist

**Migration:** `00013_agency_features_schema.sql`
**Issue:** [#8 - Agency Features](https://github.com/Wolfxinze/SMGE/issues/8)
**Date:** 2025-11-27

---

## Pre-Migration Checklist

### Environment Preparation
- [ ] **Backup database** before running migration
  ```bash
  # Local Supabase
  supabase db dump -f backup_before_agency_migration.sql

  # Production
  pg_dump -U postgres -h db.xxx.supabase.co -d postgres > backup_prod.sql
  ```

- [ ] **Run migration in local development first**
  ```bash
  supabase migration new agency_features_schema
  # Copy 00013_agency_features_schema.sql content
  supabase db reset  # Test full migration
  ```

- [ ] **Verify existing data**
  ```sql
  -- Count existing users
  SELECT COUNT(*) FROM auth.users;

  -- Count existing brands
  SELECT COUNT(*) FROM public.brands;

  -- Count existing posts
  SELECT COUNT(*) FROM public.posts;

  -- Count existing social accounts
  SELECT COUNT(*) FROM public.social_accounts;
  ```

- [ ] **Document baseline metrics**
  - Number of users: ________
  - Number of brands: ________
  - Number of posts: ________
  - Number of social accounts: ________

---

## Migration Execution Checklist

### Step 1: Run Migration
- [ ] Apply migration to local database
  ```bash
  supabase migration up
  ```

- [ ] Check for migration errors in output
- [ ] Verify migration completed without warnings

### Step 2: Validate Tables Created
- [ ] **agencies table** exists with correct columns
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agencies'
  ORDER BY ordinal_position;
  ```

- [ ] **team_members table** exists with correct columns
- [ ] **brand_members table** exists with correct columns
- [ ] **activity_logs table** exists with correct columns
- [ ] **team_invitations table** exists with correct columns

### Step 3: Validate Indexes Created
- [ ] All indexes created successfully
  ```sql
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename IN ('agencies', 'team_members', 'brand_members', 'activity_logs', 'brands', 'profiles', 'social_accounts')
  ORDER BY tablename, indexname;
  ```

### Step 4: Validate Foreign Keys
- [ ] All foreign key constraints created
  ```sql
  SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('agencies', 'team_members', 'brand_members', 'activity_logs', 'brands', 'profiles', 'social_accounts')
  ORDER BY tc.table_name;
  ```

---

## Data Migration Validation

### Backward Compatibility Tests
- [ ] **Agencies created for existing users**
  ```sql
  -- Each user with brands should have an agency
  SELECT
      COUNT(DISTINCT p.id) as users_with_brands,
      COUNT(DISTINCT a.owner_id) as users_with_agencies
  FROM public.profiles p
  LEFT JOIN public.brands b ON b.user_id = p.id
  LEFT JOIN public.agencies a ON a.owner_id = p.id
  WHERE b.id IS NOT NULL;

  -- Should be equal
  ```

- [ ] **All existing brands linked to agencies**
  ```sql
  -- No brands should have NULL agency_id
  SELECT COUNT(*) as orphaned_brands
  FROM public.brands
  WHERE agency_id IS NULL;

  -- Should be 0
  ```

- [ ] **Agency owners created as team members**
  ```sql
  -- Each agency should have an owner team member
  SELECT
      a.id,
      a.name,
      tm.role,
      tm.status
  FROM public.agencies a
  LEFT JOIN public.team_members tm ON tm.agency_id = a.id AND tm.role = 'owner'
  WHERE tm.id IS NULL;

  -- Should return 0 rows
  ```

- [ ] **Social accounts linked to brands**
  ```sql
  -- Count social accounts with brand_id
  SELECT
      COUNT(*) FILTER (WHERE brand_id IS NOT NULL) as linked,
      COUNT(*) FILTER (WHERE brand_id IS NULL) as unlinked,
      COUNT(*) as total
  FROM public.social_accounts;
  ```

- [ ] **Existing user can still access their brands**
  ```sql
  -- Test with actual user_id from your database
  SET LOCAL jwt.claims.sub = '<actual-user-uuid>';

  SELECT * FROM public.brands WHERE user_id = '<actual-user-uuid>';
  -- Should return user's brands
  ```

---

## RLS Policy Testing

### Test Setup: Create Test Users
```sql
-- Create test users (in auth.users)
-- Note: In production Supabase, use Supabase Auth API

-- Simulate users with SET LOCAL for testing
DO $$
DECLARE
    v_user1_id UUID := gen_random_uuid();
    v_user2_id UUID := gen_random_uuid();
    v_agency1_id UUID;
    v_brand1_id UUID;
BEGIN
    -- Create test agency
    SET LOCAL jwt.claims.sub = v_user1_id::text;
    INSERT INTO public.agencies (id, owner_id, name, slug)
    VALUES (gen_random_uuid(), v_user1_id, 'Test Agency', 'test-agency')
    RETURNING id INTO v_agency1_id;

    RAISE NOTICE 'Test agency created: %', v_agency1_id;
END $$;
```

### Agencies Table RLS
- [ ] **Owner can view their agency**
  ```sql
  SET LOCAL jwt.claims.sub = '<owner-user-id>';
  SELECT * FROM public.agencies WHERE owner_id = '<owner-user-id>';
  -- Should return agency
  ```

- [ ] **Team member can view their agency**
  ```sql
  -- First add team member
  SET LOCAL jwt.claims.sub = '<owner-user-id>';
  INSERT INTO public.team_members (agency_id, user_id, role, status)
  VALUES ('<agency-id>', '<member-user-id>', 'editor', 'active');

  -- Then test access
  SET LOCAL jwt.claims.sub = '<member-user-id>';
  SELECT * FROM public.agencies WHERE id = '<agency-id>';
  -- Should return agency
  ```

- [ ] **Non-member cannot view agency**
  ```sql
  SET LOCAL jwt.claims.sub = '<random-user-id>';
  SELECT * FROM public.agencies WHERE id = '<agency-id>';
  -- Should return 0 rows
  ```

- [ ] **Only owner can create agency**
  ```sql
  SET LOCAL jwt.claims.sub = '<user-id>';
  INSERT INTO public.agencies (owner_id, name, slug)
  VALUES ('<user-id>', 'New Agency', 'new-agency');
  -- Should succeed

  INSERT INTO public.agencies (owner_id, name, slug)
  VALUES ('<different-user-id>', 'Fake Agency', 'fake-agency');
  -- Should fail with RLS violation
  ```

- [ ] **Only owner can update agency**
  ```sql
  SET LOCAL jwt.claims.sub = '<non-owner-admin-id>';
  UPDATE public.agencies SET name = 'Hacked' WHERE id = '<agency-id>';
  -- Should fail

  SET LOCAL jwt.claims.sub = '<owner-id>';
  UPDATE public.agencies SET name = 'Updated' WHERE id = '<agency-id>';
  -- Should succeed
  ```

### Team Members Table RLS
- [ ] **Team members can view other members**
  ```sql
  SET LOCAL jwt.claims.sub = '<team-member-id>';
  SELECT * FROM public.team_members WHERE agency_id = '<agency-id>';
  -- Should return all team members
  ```

- [ ] **Only admin/owner can invite team members**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  INSERT INTO public.team_members (agency_id, user_id, role, status)
  VALUES ('<agency-id>', '<new-user-id>', 'viewer', 'invited');
  -- Should fail

  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  INSERT INTO public.team_members (agency_id, user_id, role, status)
  VALUES ('<agency-id>', '<new-user-id>', 'viewer', 'invited');
  -- Should succeed
  ```

- [ ] **Cannot change owner role**
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  UPDATE public.team_members
  SET role = 'admin'
  WHERE agency_id = '<agency-id>' AND role = 'owner';
  -- Should fail
  ```

- [ ] **Cannot delete owner**
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  DELETE FROM public.team_members
  WHERE agency_id = '<agency-id>' AND role = 'owner';
  -- Should fail (0 rows deleted)
  ```

### Brands Table RLS (Multi-Tenant)
- [ ] **Brand owner can view brand (legacy)**
  ```sql
  SET LOCAL jwt.claims.sub = '<brand-owner-id>';
  SELECT * FROM public.brands WHERE user_id = '<brand-owner-id>';
  -- Should return brands
  ```

- [ ] **Team member with "all" access can view brand**
  ```sql
  -- Team member has brand_access = '{"type": "all"}'
  SET LOCAL jwt.claims.sub = '<team-member-id>';
  SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
  -- Should return all agency brands
  ```

- [ ] **Team member with "specific" access can only view assigned brands**
  ```sql
  -- Update team member: brand_access = '{"type": "specific", "brand_ids": ["<brand1-id>"]}'
  SET LOCAL jwt.claims.sub = '<team-member-id>';
  SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
  -- Should only return brand1
  ```

- [ ] **Team member with "none" access cannot view brands**
  ```sql
  -- Update team member: brand_access = '{"type": "none"}'
  SET LOCAL jwt.claims.sub = '<team-member-id>';
  SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
  -- Should return 0 rows
  ```

- [ ] **Viewer cannot create brands**
  ```sql
  SET LOCAL jwt.claims.sub = '<viewer-user-id>';
  INSERT INTO public.brands (user_id, agency_id, name)
  VALUES ('<viewer-user-id>', '<agency-id>', 'Test Brand');
  -- Should fail
  ```

- [ ] **Editor can create brands**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  INSERT INTO public.brands (user_id, agency_id, name)
  VALUES ('<editor-user-id>', '<agency-id>', 'Test Brand');
  -- Should succeed
  ```

- [ ] **Admin can delete brands**
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  DELETE FROM public.brands WHERE id = '<brand-id>';
  -- Should succeed
  ```

- [ ] **Editor cannot delete brands**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  DELETE FROM public.brands WHERE id = '<brand-id>';
  -- Should fail
  ```

### Posts Table RLS (Multi-Tenant)
- [ ] **Team member can view posts for accessible brands**
  ```sql
  SET LOCAL jwt.claims.sub = '<team-member-id>';
  SELECT * FROM public.posts WHERE brand_id IN (
      SELECT id FROM public.brands WHERE agency_id = '<agency-id>'
  );
  -- Should return posts based on brand access
  ```

- [ ] **Viewer cannot create posts**
  ```sql
  SET LOCAL jwt.claims.sub = '<viewer-user-id>';
  INSERT INTO public.posts (user_id, brand_id, content_type, body)
  VALUES ('<viewer-user-id>', '<brand-id>', 'post', 'Test');
  -- Should fail
  ```

- [ ] **Editor can create posts**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  INSERT INTO public.posts (user_id, brand_id, content_type, body)
  VALUES ('<editor-user-id>', '<brand-id>', 'post', 'Test');
  -- Should succeed
  ```

- [ ] **Editor cannot delete posts**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  DELETE FROM public.posts WHERE id = '<post-id>';
  -- Should fail (0 rows deleted)
  ```

- [ ] **Admin can delete posts**
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  DELETE FROM public.posts WHERE id = '<post-id>';
  -- Should succeed
  ```

### Brand-Level Permissions RLS
- [ ] **Team member with brand-level permission override**
  ```sql
  -- Create brand_member with can_edit_posts = false for editor
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  INSERT INTO public.brand_members (brand_id, team_member_id, permissions)
  VALUES ('<brand-id>', '<editor-team-member-id>', '{"can_edit_posts": false}');

  -- Test that editor now cannot create posts for this brand
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  INSERT INTO public.posts (user_id, brand_id, content_type, body)
  VALUES ('<editor-user-id>', '<brand-id>', 'post', 'Test');
  -- Should fail due to permission override
  ```

### Activity Logs RLS
- [ ] **Only admin/owner can view activity logs**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  SELECT * FROM public.activity_logs WHERE agency_id = '<agency-id>';
  -- Should return 0 rows

  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  SELECT * FROM public.activity_logs WHERE agency_id = '<agency-id>';
  -- Should return logs
  ```

---

## Helper Functions Testing

### is_agency_owner
- [ ] Returns `true` for agency owner
  ```sql
  SELECT public.is_agency_owner('<agency-id>');
  -- Should return true for owner
  ```

- [ ] Returns `false` for non-owner
  ```sql
  SET LOCAL jwt.claims.sub = '<non-owner-id>';
  SELECT public.is_agency_owner('<agency-id>');
  -- Should return false
  ```

### is_agency_admin
- [ ] Returns `true` for owner
- [ ] Returns `true` for admin
- [ ] Returns `false` for editor
- [ ] Returns `false` for non-member

### get_user_brands
- [ ] Returns all brands for admin with "all" access
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  SELECT * FROM public.get_user_brands('<agency-id>');
  -- Should return all agency brands with full permissions
  ```

- [ ] Returns correct permissions for each role
  ```sql
  -- Owner/Admin: all permissions true
  -- Editor: can_delete false, others true
  -- Viewer: only can_view and can_view_analytics true
  -- Client: only can_view and can_view_analytics true
  ```

### can_access_brand
- [ ] Returns `true` for accessible brand
- [ ] Returns `false` for inaccessible brand
- [ ] Respects "specific" brand access restrictions

### check_brand_permission
- [ ] Returns correct permission for owner (all true)
- [ ] Returns correct permission for admin (all true)
- [ ] Returns correct permission for editor (can_delete false)
- [ ] Returns correct permission for viewer (only view true)
- [ ] Returns correct permission for client (only view/analytics true)
- [ ] Respects brand_members permission overrides
- [ ] Respects team_members permission overrides

### log_activity
- [ ] Inserts activity log successfully
  ```sql
  SELECT public.log_activity(
      '<agency-id>',
      'test.action',
      'test',
      '<entity-id>',
      '<brand-id>',
      '{"test": "data"}'::jsonb
  );
  -- Should return log UUID
  ```

- [ ] Correctly captures user_id and team_member_id
  ```sql
  SELECT user_id, team_member_id
  FROM public.activity_logs
  WHERE action = 'test.action'
  ORDER BY created_at DESC
  LIMIT 1;
  ```

---

## Performance Testing

### Query Performance
- [ ] **Brand list query (100 brands)**
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM public.brands WHERE agency_id = '<agency-id>';
  -- Should use idx_brands_agency_id
  -- Execution time < 200ms
  ```

- [ ] **Permission check query**
  ```sql
  EXPLAIN ANALYZE
  SELECT public.check_brand_permission('<user-id>', '<brand-id>', 'can_edit_posts');
  -- Execution time < 50ms
  ```

- [ ] **Activity log query (1000 logs)**
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM public.activity_logs
  WHERE agency_id = '<agency-id>'
  ORDER BY created_at DESC
  LIMIT 50;
  -- Should use idx_activity_logs_created_at
  -- Execution time < 300ms
  ```

### Index Usage
- [ ] Verify indexes are being used
  ```sql
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM public.brands WHERE agency_id = '<agency-id>' AND is_active = true;
  -- Should show "Index Scan using idx_brands_agency_active"
  ```

---

## Security Testing

### Cross-Tenant Isolation
- [ ] **User from Agency A cannot access Agency B data**
  ```sql
  -- User from Agency A
  SET LOCAL jwt.claims.sub = '<agency-a-user-id>';
  SELECT * FROM public.brands WHERE agency_id = '<agency-b-id>';
  -- Should return 0 rows
  ```

- [ ] **User cannot modify agency_id to gain access**
  ```sql
  SET LOCAL jwt.claims.sub = '<malicious-user-id>';
  UPDATE public.brands
  SET agency_id = '<target-agency-id>'
  WHERE id = '<own-brand-id>';
  -- Should fail or succeed but still not grant access to target agency
  ```

### Permission Escalation
- [ ] **Editor cannot grant themselves admin role**
  ```sql
  SET LOCAL jwt.claims.sub = '<editor-user-id>';
  UPDATE public.team_members
  SET role = 'admin'
  WHERE user_id = '<editor-user-id>';
  -- Should fail
  ```

- [ ] **Admin cannot change owner_id of agency**
  ```sql
  SET LOCAL jwt.claims.sub = '<admin-user-id>';
  UPDATE public.agencies
  SET owner_id = '<admin-user-id>'
  WHERE id = '<agency-id>';
  -- Should fail
  ```

### SQL Injection Protection
- [ ] Test all helper functions with malicious input
  ```sql
  SELECT public.can_access_brand(''; DROP TABLE brands; --');
  -- Should fail safely or return false
  ```

---

## Integration Testing

### Team Invitation Flow
- [ ] Create invitation
  ```sql
  INSERT INTO public.team_invitations (agency_id, email, role)
  VALUES ('<agency-id>', 'newuser@example.com', 'editor');
  ```

- [ ] Verify invitation token generated
- [ ] Check invitation expires_at is 7 days from now
- [ ] Accept invitation (update status, create team_member)
- [ ] Verify user can now access agency

### Brand Creation Flow
- [ ] Create brand in agency
  ```sql
  INSERT INTO public.brands (user_id, agency_id, name)
  VALUES ('<user-id>', '<agency-id>', 'New Brand');
  ```

- [ ] Verify owner can access brand
- [ ] Verify team members with "all" access can see brand
- [ ] Add brand to team member's "specific" access list
- [ ] Verify team member can now access brand

### Activity Logging
- [ ] Log is created when brand is created
- [ ] Log is created when post is published
- [ ] Log is created when team member is invited
- [ ] Logs contain correct metadata

---

## Rollback Testing

### Test Rollback Script
- [ ] **Backup database before rollback test**
- [ ] Run rollback script in test environment
  ```bash
  psql -U postgres -d smge_test -f supabase/migrations/00013_agency_features_rollback.sql
  ```

- [ ] **Verify brands still accessible**
  ```sql
  SELECT * FROM public.brands WHERE user_id = '<user-id>';
  -- Should return all user's brands
  ```

- [ ] **Verify posts still accessible**
- [ ] **Verify social accounts still accessible**
- [ ] **Verify agency tables dropped**
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  -- Should NOT include agencies, team_members, brand_members, activity_logs
  ```

- [ ] **Verify original RLS policies restored**
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'brands';
  -- Should include "Users can view own brands"
  ```

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] All tests passing in staging
- [ ] Database backup created
- [ ] Rollback script tested and verified
- [ ] Downtime window scheduled (if needed)
- [ ] Team notified of deployment

### Deployment
- [ ] Run migration in production
  ```bash
  supabase db push
  ```

- [ ] Monitor migration logs for errors
- [ ] Verify migration validation tests pass

### Post-Deployment
- [ ] Verify existing users can still access their brands
- [ ] Test user login and brand access
- [ ] Check error logs for RLS violations
- [ ] Monitor database performance (query times)
- [ ] Test team invitation flow with real email

### Monitoring (First 24 Hours)
- [ ] Monitor error rates (should be < 1%)
- [ ] Monitor query performance (p95 < 300ms)
- [ ] Monitor RLS policy hit rate
- [ ] Check for permission escalation attempts in logs
- [ ] Verify no cross-tenant data leaks

---

## Known Issues & Edge Cases

### Edge Cases to Test
- [ ] User with no brands (should not create agency)
- [ ] User with multiple brands (all should link to same agency)
- [ ] Social account with no matching brand (brand_id remains NULL)
- [ ] Deleted user (foreign keys should cascade)
- [ ] Suspended agency (is_active = false, users cannot access)

### Limitations
- [ ] Document: Maximum team members per agency (depends on subscription)
- [ ] Document: Maximum brands per agency (depends on subscription)
- [ ] Document: Activity log retention policy (recommend 1 year)

---

## Sign-Off

### Testing Completed By
- [ ] **Database Engineer:** _________________ Date: _______
- [ ] **Backend Engineer:** _________________ Date: _______
- [ ] **Security Review:** _________________ Date: _______
- [ ] **QA Engineer:** _________________ Date: _______

### Production Approval
- [ ] **Engineering Lead:** _________________ Date: _______
- [ ] **Product Manager:** _________________ Date: _______

---

## Appendix: Useful Testing Queries

### Reset Test Data
```sql
-- WARNING: Only run in development/staging
DELETE FROM public.team_invitations;
DELETE FROM public.activity_logs;
DELETE FROM public.brand_members;
DELETE FROM public.team_members WHERE role != 'owner';
DELETE FROM public.agencies WHERE name LIKE '%Test%';
```

### Check RLS Policy Coverage
```sql
SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

### View All Foreign Keys
```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

---

**End of Testing Checklist**
