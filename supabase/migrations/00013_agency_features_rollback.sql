-- ============================================================================
-- AGENCY FEATURES SCHEMA - ROLLBACK SCRIPT
-- ============================================================================
-- Migration: 00013_agency_features_schema (ROLLBACK)
-- Purpose: Safely rollback agency features migration to restore single-tenant state
-- WARNING: This will remove all agency-related data including team members,
--          but will preserve brands and posts by reverting to user_id ownership
-- ============================================================================

-- IMPORTANT: Before running this rollback:
-- 1. Backup your database: pg_dump -U postgres -d smge > backup_before_rollback.sql
-- 2. Verify no production agencies are using multi-tenant features
-- 3. Test in staging environment first

BEGIN;

-- ============================================================================
-- SECTION 1: DROP TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS on_new_user_agency ON public.profiles;
DROP TRIGGER IF EXISTS on_team_member_change ON public.team_members;
DROP TRIGGER IF EXISTS on_brand_member_change ON public.brand_members;

-- Drop trigger functions
DROP FUNCTION IF EXISTS public.handle_new_user_agency();
DROP FUNCTION IF EXISTS public.trigger_refresh_user_brand_permissions();
DROP FUNCTION IF EXISTS public.trigger_refresh_brand_member_permissions();

-- Drop permission refresh function
DROP FUNCTION IF EXISTS public.refresh_user_brand_permissions(UUID);

-- Drop helper functions
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.check_brand_permission(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.can_access_brand(UUID);
DROP FUNCTION IF EXISTS public.get_user_brands(UUID);
DROP FUNCTION IF EXISTS public.is_agency_admin(UUID);
DROP FUNCTION IF EXISTS public.is_agency_owner(UUID);

-- ============================================================================
-- SECTION 2: RESTORE ORIGINAL RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RESTORE: brands table policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view accessible brands" ON public.brands;
DROP POLICY IF EXISTS "Users can create brands in their agencies" ON public.brands;
DROP POLICY IF EXISTS "Users can update accessible brands" ON public.brands;
DROP POLICY IF EXISTS "Users can delete brands they own" ON public.brands;

-- Restore original single-tenant policies
CREATE POLICY "Users can view own brands"
    ON public.brands FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own brands"
    ON public.brands FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands"
    ON public.brands FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brands"
    ON public.brands FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- RESTORE: social_accounts table policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view accessible social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can manage social accounts for accessible brands" ON public.social_accounts;

-- Restore original policy
CREATE POLICY "Users can manage own social accounts"
    ON public.social_accounts FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- RESTORE: posts table policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view accessible posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts for accessible brands" ON public.posts;
DROP POLICY IF EXISTS "Users can update accessible posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete posts they created or have admin access" ON public.posts;

-- Restore original policies
CREATE POLICY "Users can view own posts"
    ON public.posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create posts for own brands"
    ON public.posts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = posts.brand_id
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own posts"
    ON public.posts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON public.posts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 3: REMOVE AGENCY COLUMNS FROM EXISTING TABLES
-- ============================================================================

-- Remove agency_id from brands (data preserved via user_id)
DROP INDEX IF EXISTS idx_brands_agency_id;
DROP INDEX IF EXISTS idx_brands_agency_active;
ALTER TABLE public.brands DROP COLUMN IF EXISTS agency_id;

-- Remove current_agency_id from profiles
DROP INDEX IF EXISTS idx_profiles_current_agency_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS current_agency_id;

-- Remove brand_id from social_accounts
DROP INDEX IF EXISTS idx_social_accounts_brand_id;
ALTER TABLE public.social_accounts DROP COLUMN IF EXISTS brand_id;

-- ============================================================================
-- SECTION 4: DROP AGENCY-SPECIFIC TABLES
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON public.team_invitations;
DROP TRIGGER IF EXISTS update_brand_members_updated_at ON public.brand_members;
DROP TRIGGER IF EXISTS update_team_members_updated_at ON public.team_members;
DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.team_invitations CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;  -- Drops all partitions automatically
DROP TABLE IF EXISTS public.brand_members CASCADE;
DROP TABLE IF EXISTS public.user_brand_permissions CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.agencies CASCADE;

-- ============================================================================
-- SECTION 5: VALIDATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK COMPLETED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Verification:';

    -- Check brands table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'brands'
        AND column_name = 'agency_id'
    ) THEN
        RAISE NOTICE '  ✓ agency_id removed from brands table';
    ELSE
        RAISE WARNING '  ✗ agency_id still exists in brands table';
    END IF;

    -- Check agencies table dropped
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'agencies'
    ) THEN
        RAISE NOTICE '  ✓ agencies table dropped';
    ELSE
        RAISE WARNING '  ✗ agencies table still exists';
    END IF;

    -- Check RLS policies restored
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'brands'
        AND policyname = 'Users can view own brands'
    ) THEN
        RAISE NOTICE '  ✓ Original RLS policies restored';
    ELSE
        RAISE WARNING '  ✗ Original RLS policies not found';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Database rolled back to single-tenant state.';
    RAISE NOTICE 'All brands and posts preserved with original user_id ownership.';
    RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================
-- After successful rollback:
-- 1. All brands remain accessible to original owners via user_id
-- 2. All posts remain accessible to original creators
-- 3. Social accounts remain linked to original users
-- 4. Team collaboration data is permanently deleted
-- 5. Activity logs are permanently deleted
-- 6. Test application to ensure single-tenant functionality works
-- ============================================================================
