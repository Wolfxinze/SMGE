# Agency Features Architecture Design
**Issue:** [#8 - Agency Features](https://github.com/Wolfxinze/SMGE/issues/8)
**Version:** 1.0
**Date:** 2025-11-27
**Architect:** Systems Architecture Team

---

## Executive Summary

This document defines the comprehensive architecture for transforming SMGE from a single-tenant social media management platform into a multi-tenant agency platform with white-label capabilities, team collaboration, and granular permission controls.

**Core Architectural Principle:** Pool model (shared schema) with Row-Level Security (RLS) for data isolation, hierarchical organization structure (Agency → Brand → Team Member), and JWT-based context propagation.

**Backward Compatibility:** 100% backward compatible with existing single-tenant deployments. Existing users automatically become single-brand "agencies" with full ownership permissions.

---

## 1. System Architecture Overview

### 1.1 Multi-Tenancy Model

**Chosen Pattern:** Pool Model (Shared Schema) with RLS
**Rationale:**
- Cost-effective for SaaS deployment
- Supabase native RLS support provides database-level security
- Simpler operational overhead than database-per-tenant
- Proven pattern for agency platforms managing 100+ brands

**Tenant Hierarchy:**
```
Agency (Workspace)
  ├── Brands (Multiple)
  │   ├── Social Accounts
  │   ├── Posts & Content
  │   └── Analytics
  └── Team Members (Roles: Owner, Admin, Editor, Viewer, Client)
```

### 1.2 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENCY MULTI-TENANT MODEL                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   AGENCIES   │◄────────│     USERS    │────────►│ TEAM_MEMBERS │
└──────┬───────┘         └──────────────┘         └──────┬───────┘
       │                                                  │
       │ 1:N                                             │ N:M
       │                                                  │
       ▼                                                  ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    BRANDS    │◄────────│BRAND_MEMBERS │────────►│    ROLES     │
└──────┬───────┘         └──────────────┘         └──────────────┘
       │
       │ 1:N
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   POSTS     │  │SOCIAL_ACCOUNTS│  │  ANALYTICS   │  │ BRAND_BRAIN  │
└─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

KEY:
─── Direct Relationship
◄─► Bidirectional Reference
1:N One-to-Many
N:M Many-to-Many
```

---

## 2. Database Schema Design

### 2.1 New Tables

#### Table: `agencies`
**Purpose:** Top-level workspace for agency operations

```sql
CREATE TABLE public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE, -- URL-safe identifier
    website VARCHAR(500),

    -- White-Label Configuration
    branding JSONB DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "logo_url": "https://...",
    --   "primary_color": "#1A73E8",
    --   "secondary_color": "#34A853",
    --   "custom_domain": "dashboard.agency.com",
    --   "favicon_url": "https://...",
    --   "email_from_name": "Agency Name",
    --   "hide_smge_branding": false
    -- }

    -- Subscription & Limits
    subscription_tier TEXT DEFAULT 'agency' CHECK (subscription_tier IN ('agency', 'agency_pro', 'enterprise')),
    subscription_id UUID REFERENCES public.subscriptions(id),

    -- Usage Limits Override (null = use plan defaults)
    custom_limits JSONB,
    -- Structure: {
    --   "max_brands": 50,
    --   "max_team_members": 10,
    --   "max_client_seats": 25
    -- }

    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "require_2fa": false,
    --   "allow_client_posting": false,
    --   "default_brand_permissions": {...},
    --   "sso_enabled": false
    -- }

    -- Status
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agencies_slug_format CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Indexes
CREATE INDEX idx_agencies_owner_id ON public.agencies(owner_id);
CREATE INDEX idx_agencies_slug ON public.agencies(slug);
CREATE INDEX idx_agencies_active ON public.agencies(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Users can view agencies they own or are members of
CREATE POLICY "Users can view accessible agencies"
    ON public.agencies FOR SELECT
    USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = agencies.id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
        )
    );

-- Only owners can create agencies
CREATE POLICY "Users can create agencies"
    ON public.agencies FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Only owners can update their agencies
CREATE POLICY "Owners can update agencies"
    ON public.agencies FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Only owners can delete their agencies (soft delete via is_active)
CREATE POLICY "Owners can delete agencies"
    ON public.agencies FOR DELETE
    USING (auth.uid() = owner_id);
```

---

#### Table: `team_members`
**Purpose:** Agency team roster with role-based permissions

```sql
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role Assignment
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'client')),
    -- owner: Full control (assigned automatically to agency creator)
    -- admin: Manage team, brands, settings (cannot delete agency)
    -- editor: Create/edit content, manage scheduling
    -- viewer: Read-only access to assigned brands
    -- client: Limited dashboard view, approval workflow only

    -- Invitation State
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,

    -- Access Control
    brand_access JSONB DEFAULT '{"type": "all", "brand_ids": []}'::jsonb,
    -- Structure:
    -- {"type": "all"} - Access to all brands
    -- {"type": "specific", "brand_ids": ["uuid1", "uuid2"]} - Only specific brands
    -- {"type": "none"} - No brand access (agency-level only)

    permissions_override JSONB,
    -- Optional granular permission override
    -- Structure: {
    --   "can_publish": false,
    --   "can_delete_posts": false,
    --   "can_manage_social_accounts": true
    -- }

    -- Metadata
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT team_members_agency_user_unique UNIQUE(agency_id, user_id)
);

-- Indexes
CREATE INDEX idx_team_members_agency_id ON public.team_members(agency_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_role ON public.team_members(role);
CREATE INDEX idx_team_members_status ON public.team_members(status);

-- RLS Policies
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team members can view other members in their agency
CREATE POLICY "Users can view team members in their agencies"
    ON public.team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = team_members.agency_id
            AND (
                a.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm2
                    WHERE tm2.agency_id = a.id
                    AND tm2.user_id = auth.uid()
                    AND tm2.status = 'active'
                )
            )
        )
    );

-- Only owners and admins can invite team members
CREATE POLICY "Admins can invite team members"
    ON public.team_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = team_members.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = team_members.agency_id
            AND a.owner_id = auth.uid()
        )
    );

-- Owners and admins can update team members (except owner role)
CREATE POLICY "Admins can update team members"
    ON public.team_members FOR UPDATE
    USING (
        -- Can update if you're owner or admin
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = team_members.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
        -- Or if you're updating your own record (accepting invitation)
        OR user_id = auth.uid()
    )
    WITH CHECK (
        -- Cannot demote owner unless you are owner
        (team_members.role != 'owner' OR auth.uid() = (
            SELECT owner_id FROM public.agencies WHERE id = team_members.agency_id
        ))
    );

-- Owners and admins can remove team members
CREATE POLICY "Admins can remove team members"
    ON public.team_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = team_members.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
        -- Cannot remove owner
        AND team_members.role != 'owner'
    );
```

---

#### Table: `brand_members`
**Purpose:** Brand-level access control (for granular permissions)

```sql
CREATE TABLE public.brand_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,

    -- Permissions
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "can_view": true,
    --   "can_edit_posts": true,
    --   "can_publish": false,
    --   "can_delete": false,
    --   "can_manage_social_accounts": false,
    --   "can_view_analytics": true
    -- }

    -- Metadata
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT brand_members_brand_team_unique UNIQUE(brand_id, team_member_id)
);

-- Indexes
CREATE INDEX idx_brand_members_brand_id ON public.brand_members(brand_id);
CREATE INDEX idx_brand_members_team_member_id ON public.brand_members(team_member_id);

-- RLS Policies
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;

-- Users can view brand memberships for brands they have access to
CREATE POLICY "Users can view brand memberships"
    ON public.brand_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = brand_members.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
        )
    );

-- Owners and admins can manage brand memberships
CREATE POLICY "Admins can manage brand memberships"
    ON public.brand_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = brand_members.brand_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = brand_members.brand_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    );
```

---

#### Table: `activity_logs`
**Purpose:** Audit trail for compliance and debugging

```sql
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

    -- Actor Information
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,

    -- Action Details
    action TEXT NOT NULL, -- "brand.created", "post.published", "team.member_invited"
    entity_type TEXT NOT NULL, -- "brand", "post", "team_member"
    entity_id UUID, -- ID of affected entity

    -- Context
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Structure: {
    --   "old_values": {...},
    --   "new_values": {...},
    --   "ip_address": "192.168.1.1",
    --   "user_agent": "..."
    -- }

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activity_logs_agency_id ON public.activity_logs(agency_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_brand_id ON public.activity_logs(brand_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Partitioning recommendation: Partition by created_at monthly for performance
-- CREATE TABLE activity_logs_2025_11 PARTITION OF activity_logs
-- FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- RLS Policies
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for their agencies
CREATE POLICY "Users can view agency activity logs"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = activity_logs.agency_id
            AND (
                a.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.agency_id = a.id
                    AND tm.user_id = auth.uid()
                    AND tm.role IN ('owner', 'admin')
                    AND tm.status = 'active'
                )
            )
        )
    );

-- Service role can insert activity logs
CREATE POLICY "Service role can insert activity logs"
    ON public.activity_logs FOR INSERT
    TO service_role
    WITH CHECK (true);
```

---

### 2.2 Schema Modifications to Existing Tables

#### Modify: `brands` table
Add agency relationship and migrate existing data

```sql
-- Add agency_id column (nullable during migration)
ALTER TABLE public.brands
ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_brands_agency_id ON public.brands(agency_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can create own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can delete own brands" ON public.brands;

-- New RLS policies for multi-tenant
CREATE POLICY "Users can view accessible brands"
    ON public.brands FOR SELECT
    USING (
        -- Direct owner (legacy single-tenant)
        auth.uid() = user_id
        OR
        -- Agency member with brand access
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = brands.agency_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                -- Has access to all brands
                tm.brand_access->>'type' = 'all'
                OR
                -- Has access to specific brand
                (tm.brand_access->>'type' = 'specific'
                 AND brands.id::text = ANY(
                    SELECT jsonb_array_elements_text(tm.brand_access->'brand_ids')
                ))
            )
        )
    );

CREATE POLICY "Users can create brands in their agencies"
    ON public.brands FOR INSERT
    WITH CHECK (
        -- Legacy: User is creator
        auth.uid() = user_id
        OR
        -- Agency: User is owner/admin of agency
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = brands.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin', 'editor')
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Users can update accessible brands"
    ON public.brands FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.team_members tm
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = brands.id
            WHERE tm.agency_id = brands.agency_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.role IN ('owner', 'admin', 'editor')
                OR (bm.permissions->>'can_edit_posts')::boolean = true
            )
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = brands.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin', 'editor')
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Users can delete brands they own"
    ON public.brands FOR DELETE
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.agency_id = brands.agency_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    );
```

---

#### Modify: `profiles` table
Add agency context

```sql
-- Add current_agency_id for session context
ALTER TABLE public.profiles
ADD COLUMN current_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_profiles_current_agency_id ON public.profiles(current_agency_id);

-- Profiles RLS already exists, no changes needed
```

---

#### Modify: `social_accounts` table
Link to brands, inherit agency permissions

```sql
-- Add brand_id for explicit relationship
ALTER TABLE public.social_accounts
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_social_accounts_brand_id ON public.social_accounts(brand_id);

-- Update RLS policies to use brand permissions
DROP POLICY IF EXISTS "Users can manage own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can manage own social accounts with auth" ON public.social_accounts;

CREATE POLICY "Users can view accessible social accounts"
    ON public.social_accounts FOR SELECT
    USING (
        -- Direct owner (legacy)
        auth.uid() = user_id
        OR
        -- Brand member with access
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = social_accounts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.brand_access->>'type' = 'all'
                OR (tm.brand_access->>'type' = 'specific'
                    AND b.id::text = ANY(
                        SELECT jsonb_array_elements_text(tm.brand_access->'brand_ids')
                    ))
            )
        )
    );

CREATE POLICY "Users can manage social accounts for accessible brands"
    ON public.social_accounts FOR ALL
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
            WHERE b.id = social_accounts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.role IN ('owner', 'admin', 'editor')
                OR (bm.permissions->>'can_manage_social_accounts')::boolean = true
            )
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = social_accounts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin', 'editor')
            AND tm.status = 'active'
        )
    );
```

---

#### Modify: `posts` table (and related: scheduled_posts, generated_posts)
Inherit brand permissions for content access

```sql
-- Posts table already has brand_id from migration 00010
-- Update RLS policies to use agency permissions

DROP POLICY IF EXISTS "Users can view own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

CREATE POLICY "Users can view accessible posts"
    ON public.posts FOR SELECT
    USING (
        -- Direct creator
        auth.uid() = user_id
        OR
        -- Brand member with access
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
            WHERE b.id = posts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.brand_access->>'type' = 'all'
                OR (tm.brand_access->>'type' = 'specific'
                    AND b.id::text = ANY(
                        SELECT jsonb_array_elements_text(tm.brand_access->'brand_ids')
                    ))
            )
            AND (
                tm.role IN ('owner', 'admin', 'editor', 'viewer')
                OR COALESCE((bm.permissions->>'can_view')::boolean, false) = true
            )
        )
    );

CREATE POLICY "Users can create posts for accessible brands"
    ON public.posts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
            WHERE b.id = posts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.role IN ('owner', 'admin', 'editor')
                OR COALESCE((bm.permissions->>'can_edit_posts')::boolean, false) = true
            )
        )
    );

CREATE POLICY "Users can update accessible posts"
    ON public.posts FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
            WHERE b.id = posts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.role IN ('owner', 'admin', 'editor')
                OR COALESCE((bm.permissions->>'can_edit_posts')::boolean, false) = true
            )
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            WHERE b.id = posts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin', 'editor')
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Users can delete posts they created or have admin access"
    ON public.posts FOR DELETE
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.brands b
            JOIN public.team_members tm ON tm.agency_id = b.agency_id
            LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
            WHERE b.id = posts.brand_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
                tm.role IN ('owner', 'admin')
                OR COALESCE((bm.permissions->>'can_delete')::boolean, false) = true
            )
        )
    );

-- Apply similar policies to scheduled_posts, generated_posts, post_versions
```

---

### 2.3 Helper Functions

```sql
-- Function: Check user permission for specific action on brand
CREATE OR REPLACE FUNCTION public.check_brand_permission(
    p_user_id UUID,
    p_brand_id UUID,
    p_permission TEXT -- "can_view", "can_edit_posts", "can_publish", etc.
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.brands b
        JOIN public.team_members tm ON tm.agency_id = b.agency_id
        LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
        WHERE b.id = p_brand_id
        AND tm.user_id = p_user_id
        AND tm.status = 'active'
        AND (
            -- Owner/Admin have all permissions
            tm.role IN ('owner', 'admin')
            OR
            -- Editor has most permissions except delete
            (tm.role = 'editor' AND p_permission != 'can_delete')
            OR
            -- Viewer can only view
            (tm.role = 'viewer' AND p_permission = 'can_view')
            OR
            -- Check explicit permission in brand_members
            COALESCE((bm.permissions->>p_permission)::boolean, false) = true
            OR
            -- Check permission override in team_members
            COALESCE((tm.permissions_override->>p_permission)::boolean, false) = true
        )
    ) INTO v_has_permission;

    RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Get user's agencies
CREATE OR REPLACE FUNCTION public.get_user_agencies(p_user_id UUID)
RETURNS TABLE (
    agency_id UUID,
    agency_name VARCHAR(255),
    agency_slug VARCHAR(100),
    user_role TEXT,
    is_owner BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.slug,
        COALESCE(tm.role, 'owner') as user_role,
        (a.owner_id = p_user_id) as is_owner
    FROM public.agencies a
    LEFT JOIN public.team_members tm ON tm.agency_id = a.id AND tm.user_id = p_user_id
    WHERE a.owner_id = p_user_id
        OR (tm.user_id = p_user_id AND tm.status = 'active')
    ORDER BY is_owner DESC, a.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Get brands accessible to user in agency
CREATE OR REPLACE FUNCTION public.get_user_brands_in_agency(
    p_user_id UUID,
    p_agency_id UUID
)
RETURNS TABLE (
    brand_id UUID,
    brand_name VARCHAR(255),
    user_permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        CASE
            WHEN tm.role IN ('owner', 'admin') THEN
                '{"can_view": true, "can_edit_posts": true, "can_publish": true, "can_delete": true, "can_manage_social_accounts": true}'::jsonb
            WHEN tm.role = 'editor' THEN
                '{"can_view": true, "can_edit_posts": true, "can_publish": true, "can_delete": false, "can_manage_social_accounts": true}'::jsonb
            WHEN tm.role = 'viewer' THEN
                '{"can_view": true, "can_edit_posts": false, "can_publish": false, "can_delete": false, "can_manage_social_accounts": false}'::jsonb
            ELSE
                COALESCE(bm.permissions, '{}'::jsonb)
        END as user_permissions
    FROM public.brands b
    JOIN public.team_members tm ON tm.agency_id = b.agency_id
    LEFT JOIN public.brand_members bm ON bm.team_member_id = tm.id AND bm.brand_id = b.id
    WHERE b.agency_id = p_agency_id
        AND tm.user_id = p_user_id
        AND tm.status = 'active'
        AND (
            tm.brand_access->>'type' = 'all'
            OR (tm.brand_access->>'type' = 'specific'
                AND b.id::text = ANY(
                    SELECT jsonb_array_elements_text(tm.brand_access->'brand_ids')
                ))
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Log activity
CREATE OR REPLACE FUNCTION public.log_activity(
    p_agency_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_brand_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_team_member_id UUID;
BEGIN
    -- Get team_member_id if applicable
    SELECT id INTO v_team_member_id
    FROM public.team_members
    WHERE agency_id = p_agency_id
        AND user_id = auth.uid()
        AND status = 'active'
    LIMIT 1;

    INSERT INTO public.activity_logs (
        agency_id,
        user_id,
        team_member_id,
        action,
        entity_type,
        entity_id,
        brand_id,
        metadata
    ) VALUES (
        p_agency_id,
        auth.uid(),
        v_team_member_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_brand_id,
        p_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Permission Matrix

### 3.1 Role-Based Permissions

| Action / Role | Owner | Admin | Editor | Viewer | Client |
|--------------|-------|-------|--------|--------|--------|
| **Agency Management** |
| Create Agency | ✅ | - | - | - | - |
| Update Agency Settings | ✅ | ✅ | - | - | - |
| Delete Agency | ✅ | - | - | - | - |
| View Agency Analytics | ✅ | ✅ | ✅ | ✅ | - |
| **Team Management** |
| Invite Team Members | ✅ | ✅ | - | - | - |
| Remove Team Members | ✅ | ✅ | - | - | - |
| Change Member Roles | ✅ | ✅* | - | - | - |
| View Team List | ✅ | ✅ | ✅ | ✅ | - |
| **Brand Management** |
| Create Brand | ✅ | ✅ | ✅ | - | - |
| Update Brand Settings | ✅ | ✅ | ✅ | - | - |
| Delete Brand | ✅ | ✅ | - | - | - |
| View Brand Details | ✅ | ✅ | ✅ | ✅ | ✅** |
| **Content Operations** |
| Create Posts | ✅ | ✅ | ✅ | - | - |
| Edit Posts (Own) | ✅ | ✅ | ✅ | - | - |
| Edit Posts (Others') | ✅ | ✅ | ✅ | - | - |
| Delete Posts | ✅ | ✅ | - | - | - |
| Publish/Schedule Posts | ✅ | ✅ | ✅ | - | - |
| View Posts | ✅ | ✅ | ✅ | ✅ | ✅** |
| Approve Posts | ✅ | ✅ | ✅*** | - | ✅ |
| **Social Accounts** |
| Connect Account | ✅ | ✅ | ✅ | - | - |
| Disconnect Account | ✅ | ✅ | - | - | - |
| View Account Tokens | ✅ | - | - | - | - |
| **Analytics** |
| View Analytics | ✅ | ✅ | ✅ | ✅ | ✅** |
| Export Reports | ✅ | ✅ | ✅ | - | - |
| **White-Label** |
| Configure Branding | ✅ | ✅ | - | - | - |
| Set Custom Domain | ✅ | - | - | - | - |
| **Activity Logs** |
| View All Logs | ✅ | ✅ | - | - | - |
| View Brand Logs | ✅ | ✅ | ✅ | - | - |

**Notes:**
- \* Admins cannot change owner role or demote other admins
- \** Clients only see brands they're explicitly assigned to
- \*** Editors can approve if workflow enabled and they have permission override

### 3.2 Permission Inheritance

```
┌─────────────────────────────────────────────────┐
│         PERMISSION INHERITANCE FLOW              │
└─────────────────────────────────────────────────┘

Agency Level (team_members.role)
    │
    ├─► owner: All permissions across all brands
    ├─► admin: Manage agency + all brand permissions
    ├─► editor: Create/edit content for assigned brands
    ├─► viewer: Read-only for assigned brands
    └─► client: Limited view + approval workflow
         │
         ▼
Brand Level (brand_access in team_members)
    │
    ├─► "all": Access to all brands in agency
    └─► "specific": Access to specific brand_ids only
         │
         ▼
Granular Permissions (brand_members.permissions)
    │
    └─► Override role defaults with specific permissions
         e.g., "can_publish": false for editor role
```

### 3.3 Access Control Decision Algorithm

```javascript
function canPerformAction(userId, brandId, action) {
  // 1. Get user's team membership
  const teamMember = getTeamMemberForBrand(userId, brandId);

  // 2. Check if user has brand access
  if (teamMember.brand_access.type === 'specific') {
    if (!teamMember.brand_access.brand_ids.includes(brandId)) {
      return false; // No access to this brand
    }
  }

  // 3. Check role-based permissions (defaults)
  const rolePermissions = {
    owner: ['*'], // All permissions
    admin: ['*'],
    editor: ['can_view', 'can_edit_posts', 'can_publish', 'can_manage_social_accounts'],
    viewer: ['can_view'],
    client: ['can_view', 'can_approve']
  };

  if (rolePermissions[teamMember.role].includes('*') ||
      rolePermissions[teamMember.role].includes(action)) {
    return true;
  }

  // 4. Check permission override in team_members
  if (teamMember.permissions_override?.[action] !== undefined) {
    return teamMember.permissions_override[action];
  }

  // 5. Check granular brand_members permission
  const brandMember = getBrandMember(teamMember.id, brandId);
  if (brandMember?.permissions?.[action] !== undefined) {
    return brandMember.permissions[action];
  }

  return false; // Default deny
}
```

---

## 4. API Endpoint Design

### 4.1 Agency Management APIs

#### `POST /api/agencies`
Create new agency workspace

**Request:**
```json
{
  "name": "Acme Digital Agency",
  "slug": "acme-digital", // Optional, auto-generated from name
  "website": "https://acmedigital.com",
  "branding": {
    "logo_url": "https://...",
    "primary_color": "#1A73E8"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Acme Digital Agency",
  "slug": "acme-digital",
  "owner_id": "uuid",
  "created_at": "2025-11-27T10:00:00Z",
  "subscription_tier": "agency"
}
```

---

#### `GET /api/agencies`
List user's agencies

**Response:**
```json
{
  "agencies": [
    {
      "id": "uuid",
      "name": "Acme Digital Agency",
      "slug": "acme-digital",
      "role": "owner",
      "is_owner": true,
      "brand_count": 15,
      "team_member_count": 8
    }
  ]
}
```

---

#### `PATCH /api/agencies/:id`
Update agency settings

**Request:**
```json
{
  "branding": {
    "primary_color": "#FF5733",
    "hide_smge_branding": true
  },
  "settings": {
    "require_2fa": true,
    "default_brand_permissions": {
      "can_publish": false // Require approval by default
    }
  }
}
```

---

### 4.2 Team Management APIs

#### `POST /api/agencies/:agency_id/team/invite`
Invite team member

**Request:**
```json
{
  "email": "editor@example.com",
  "role": "editor",
  "brand_access": {
    "type": "specific",
    "brand_ids": ["brand-uuid-1", "brand-uuid-2"]
  },
  "permissions_override": {
    "can_publish": false // Require approval
  }
}
```

**Response:**
```json
{
  "team_member": {
    "id": "uuid",
    "user_id": null, // Not yet accepted
    "role": "editor",
    "status": "invited",
    "invited_at": "2025-11-27T10:00:00Z",
    "invitation_link": "https://app.smge.com/invite/abc123"
  }
}
```

---

#### `GET /api/agencies/:agency_id/team`
List team members

**Response:**
```json
{
  "team_members": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "email": "owner@agency.com",
        "full_name": "John Doe"
      },
      "role": "owner",
      "status": "active",
      "brand_access": {"type": "all"},
      "last_activity_at": "2025-11-27T09:30:00Z"
    }
  ]
}
```

---

#### `PATCH /api/agencies/:agency_id/team/:member_id`
Update team member

**Request:**
```json
{
  "role": "admin",
  "brand_access": {
    "type": "all"
  }
}
```

---

#### `DELETE /api/agencies/:agency_id/team/:member_id`
Remove team member

---

### 4.3 Brand Access APIs

#### `POST /api/brands/:brand_id/members`
Grant brand-specific permissions

**Request:**
```json
{
  "team_member_id": "uuid",
  "permissions": {
    "can_view": true,
    "can_edit_posts": true,
    "can_publish": false,
    "can_delete": false
  }
}
```

---

#### `GET /api/agencies/:agency_id/brands`
List agency brands (filtered by user access)

**Response:**
```json
{
  "brands": [
    {
      "id": "uuid",
      "name": "Client Brand A",
      "user_permissions": {
        "can_view": true,
        "can_edit_posts": true,
        "can_publish": true
      },
      "post_count": 45,
      "social_accounts": ["instagram", "twitter"]
    }
  ]
}
```

---

### 4.4 Activity Log APIs

#### `GET /api/agencies/:agency_id/activity`
Get agency activity logs

**Query Params:**
- `brand_id`: Filter by specific brand
- `action`: Filter by action type
- `user_id`: Filter by user
- `start_date`, `end_date`: Date range
- `limit`, `offset`: Pagination

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "action": "post.published",
      "user": {
        "id": "uuid",
        "full_name": "Jane Editor"
      },
      "brand": {
        "id": "uuid",
        "name": "Client Brand A"
      },
      "metadata": {
        "post_title": "New Product Launch",
        "platforms": ["instagram", "twitter"]
      },
      "created_at": "2025-11-27T09:15:00Z"
    }
  ],
  "pagination": {
    "total": 1523,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 4.5 White-Label APIs

#### `GET /api/agencies/:agency_id/branding`
Get white-label configuration

**Response:**
```json
{
  "logo_url": "https://cdn.agency.com/logo.png",
  "primary_color": "#1A73E8",
  "secondary_color": "#34A853",
  "custom_domain": "dashboard.agency.com",
  "hide_smge_branding": true
}
```

---

#### `PATCH /api/agencies/:agency_id/branding`
Update white-label configuration

**Request:**
```json
{
  "logo_url": "https://new-logo.png",
  "primary_color": "#FF5733"
}
```

---

### 4.6 Client Portal APIs

#### `GET /api/client/dashboard`
Client-facing dashboard (limited view)

**Response:**
```json
{
  "brands": [
    {
      "id": "uuid",
      "name": "My Brand",
      "pending_approvals": 3,
      "scheduled_posts": 12,
      "recent_analytics": {
        "followers": 15230,
        "engagement_rate": 4.2
      }
    }
  ],
  "agency_branding": {
    "logo_url": "https://...",
    "name": "Acme Digital Agency"
  }
}
```

---

## 5. Frontend Component Hierarchy

### 5.1 Component Architecture

```
App (Context: AgencyContext, UserContext)
│
├── AgencySelector (if user has multiple agencies)
│   └── AgencyList
│       └── AgencyCard
│
├── Dashboard (agency-scoped)
│   ├── AgencyOverview
│   │   ├── BrandList (filtered by permissions)
│   │   ├── TeamActivity
│   │   └── UsageMetrics
│   │
│   ├── BrandDashboard (brand-scoped)
│   │   ├── ContentCalendar
│   │   ├── PostList (filtered by permissions)
│   │   ├── Analytics
│   │   └── SocialAccounts
│   │
│   └── TeamManagement (admin/owner only)
│       ├── TeamMemberList
│       ├── InviteMemberModal
│       └── PermissionEditor
│
├── Settings
│   ├── AgencySettings (owner/admin only)
│   │   ├── GeneralSettings
│   │   ├── WhiteLabelConfig
│   │   └── BillingSettings
│   │
│   └── UserSettings
│       ├── ProfileSettings
│       └── NotificationPreferences
│
└── ClientPortal (client role only)
    ├── ClientDashboard
    ├── ApprovalQueue
    └── AnalyticsView
```

### 5.2 Context Providers

**AgencyContext**
```typescript
interface AgencyContextValue {
  currentAgency: Agency | null;
  agencies: Agency[];
  switchAgency: (agencyId: string) => Promise<void>;
  userRole: 'owner' | 'admin' | 'editor' | 'viewer' | 'client';
  permissions: {
    canManageTeam: boolean;
    canManageBrands: boolean;
    canConfigureWhiteLabel: boolean;
  };
}
```

**BrandContext**
```typescript
interface BrandContextValue {
  currentBrand: Brand | null;
  accessibleBrands: Brand[];
  switchBrand: (brandId: string) => void;
  userPermissions: BrandPermissions;
  canPerform: (action: string) => boolean;
}
```

### 5.3 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION                    │
│         (Supabase Auth → JWT with custom claims)         │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              LOAD USER AGENCIES & ROLES                   │
│      GET /api/agencies → AgencyContext.setAgencies       │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│             SELECT/SWITCH AGENCY (if multiple)            │
│    AgencyContext.switchAgency(id) → Store in session     │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│             LOAD ACCESSIBLE BRANDS IN AGENCY              │
│   GET /api/agencies/:id/brands → BrandContext.setBrands  │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│               SELECT BRAND → LOAD CONTENT                 │
│      BrandContext.switchBrand(id) → Render Dashboard     │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Permission Guards

**Component-level guards**
```typescript
// Can only render if user has permission
<PermissionGuard requires="can_manage_team">
  <TeamManagement />
</PermissionGuard>

// Show different UI based on role
<RoleBasedRender
  owner={<FullAdminPanel />}
  admin={<LimitedAdminPanel />}
  editor={<ContentEditorPanel />}
  viewer={<ReadOnlyPanel />}
  client={<ClientPortal />}
/>
```

**Route-level guards**
```typescript
// Protect routes based on agency membership
<ProtectedRoute
  path="/agencies/:agencyId/settings"
  requiredRole={['owner', 'admin']}
  fallback="/unauthorized"
>
  <AgencySettings />
</ProtectedRoute>
```

---

## 6. Migration Plan: Single-Tenant → Multi-Tenant

### 6.1 Migration Strategy

**Principle:** Zero downtime, backward compatible, phased rollout

**Phase 1: Database Schema Migration (Week 1)**

1. **Deploy new tables** (agencies, team_members, brand_members, activity_logs)
   - Run migration: `00012_agency_features_schema.sql`
   - Tables deployed but not actively used yet

2. **Add agency_id column to brands** (nullable initially)
   - Deploy migration: `00013_brands_agency_relationship.sql`
   - No data changes yet

3. **Backfill existing data**
   - Create "default agency" for each existing user
   - Update brands.agency_id to link to user's default agency
   - Create team_member record with 'owner' role

   ```sql
   -- Migration script
   INSERT INTO public.agencies (owner_id, name, slug, is_active)
   SELECT
       p.id,
       COALESCE(p.company_name, p.full_name || '''s Agency'),
       'user-' || SUBSTRING(p.id::text, 1, 8),
       true
   FROM public.profiles p
   WHERE NOT EXISTS (
       SELECT 1 FROM public.agencies WHERE owner_id = p.id
   );

   UPDATE public.brands b
   SET agency_id = a.id
   FROM public.agencies a
   WHERE b.user_id = a.owner_id
   AND b.agency_id IS NULL;

   INSERT INTO public.team_members (agency_id, user_id, role, status, accepted_at)
   SELECT a.id, a.owner_id, 'owner', 'active', NOW()
   FROM public.agencies a
   WHERE NOT EXISTS (
       SELECT 1 FROM public.team_members
       WHERE agency_id = a.id AND user_id = a.owner_id
   );
   ```

4. **Deploy new RLS policies**
   - Run migration: `00014_agency_rls_policies.sql`
   - Policies allow both old (user_id) and new (agency_id) access patterns
   - Test extensively in staging

**Phase 2: Application Layer Migration (Week 2-3)**

1. **Update backend API**
   - Add agency context to request handlers
   - Implement new agency/team management endpoints
   - Keep existing endpoints functional (legacy support)

2. **Update frontend**
   - Add AgencyContext provider
   - Implement agency selector UI
   - Gradually migrate components to use agency context
   - Feature flag: `ENABLE_AGENCY_FEATURES` (default: false)

3. **Deploy with feature flag disabled**
   - All existing users see single-tenant UI
   - New multi-tenant code deployed but inactive

**Phase 3: Gradual Rollout (Week 4)**

1. **Enable for beta users** (opt-in)
   - Set feature flag for select users
   - Monitor performance and errors
   - Collect feedback

2. **Enable for all "agency" tier subscribers**
   - Auto-enable for users on agency plan
   - Others can upgrade to access features

3. **Full rollout**
   - Enable for all users
   - Single-brand users see simplified UI (no agency selector)
   - Multi-brand users see full agency features

**Phase 4: Cleanup (Week 5)**

1. **Make agency_id NOT NULL**
   ```sql
   ALTER TABLE public.brands
   ALTER COLUMN agency_id SET NOT NULL;
   ```

2. **Remove legacy RLS policies** (if any remain)

3. **Remove feature flag**

### 6.2 Rollback Strategy

**If critical issues arise during rollout:**

1. **Toggle feature flag OFF**
   - Instantly revert all users to single-tenant UI
   - Multi-tenant data preserved, just not exposed

2. **Database rollback points**
   - Phase 1: Before backfill (revert migrations)
   - Phase 2: After backfill (keep data, revert policies)
   - Phase 3+: Cannot revert schema, only toggle features

3. **Monitoring alerts**
   - RLS policy performance degradation (>100ms queries)
   - Increased error rate (>1% on agency endpoints)
   - Permission bypass attempts (security alerts)

### 6.3 Testing Checklist

**Database Tests:**
- [ ] RLS policies prevent cross-tenant data access
- [ ] Team member can only see assigned brands
- [ ] Viewer role cannot edit posts
- [ ] Client role cannot see team management
- [ ] Activity logs record all actions correctly

**API Tests:**
- [ ] Agency creation and management
- [ ] Team member invitation flow
- [ ] Permission checks on all endpoints
- [ ] Brand access filtering works correctly
- [ ] White-label branding applies correctly

**Frontend Tests:**
- [ ] Agency selector shows correct agencies
- [ ] Brand list filtered by permissions
- [ ] Permission guards hide unauthorized UI
- [ ] Client portal shows limited view
- [ ] Activity logs render correctly

**Performance Tests:**
- [ ] Brand list query <200ms with 100 brands
- [ ] Post list query <300ms with 1000 posts
- [ ] Permission check <50ms average
- [ ] Activity log pagination efficient

**Security Tests:**
- [ ] Cannot access other agency's brands via API
- [ ] Cannot escalate role via API manipulation
- [ ] JWT tampering detected and rejected
- [ ] SQL injection attempts blocked by RLS
- [ ] XSS protection in white-label branding fields

---

## 7. Security Model & Threat Analysis

### 7.1 Security Architecture

**Defense in Depth Layers:**

1. **Authentication Layer** (Supabase Auth)
   - JWT-based authentication
   - Secure session management
   - MFA support for admin roles

2. **Authorization Layer** (RLS Policies)
   - Database-level access control
   - Multi-tenant isolation enforced by Postgres
   - Cannot bypass even with direct SQL access

3. **Application Layer** (API Guards)
   - Permission checks before business logic
   - Rate limiting per agency
   - Input validation and sanitization

4. **Audit Layer** (Activity Logs)
   - All actions logged immutably
   - Tamper-proof timestamps
   - Compliance trail for SOC 2

### 7.2 Threat Model

#### Threat 1: Cross-Tenant Data Leakage
**Attack Vector:** Attacker modifies API request to access another agency's data
**Impact:** CRITICAL - Confidentiality breach
**Mitigation:**
- RLS policies enforce `agency_id` filtering on all queries
- JWT contains verified `user_id`, not client-supplied
- No direct agency_id in client requests (derived from team_members join)
- Automated tests verify isolation

**Residual Risk:** LOW (RLS tested extensively)

---

#### Threat 2: Privilege Escalation
**Attack Vector:** Team member attempts to grant themselves admin role
**Impact:** HIGH - Unauthorized access to agency settings
**Mitigation:**
- RLS policy prevents role changes unless requester is owner/admin
- API validates role changes server-side (never trust client)
- Owner role can only be assigned to agency creator
- Activity logs record all role changes

**Residual Risk:** LOW

---

#### Threat 3: Invitation Link Abuse
**Attack Vector:** Invitation link leaked, unauthorized user accepts
**Impact:** MEDIUM - Unintended agency access
**Mitigation:**
- Invitation links expire after 7 days
- Email verification required before acceptance
- Owner/admin can revoke pending invitations
- Activity log shows who accepted invitation

**Residual Risk:** MEDIUM (depends on email security)

---

#### Threat 4: White-Label XSS
**Attack Vector:** Malicious HTML in custom branding fields
**Impact:** MEDIUM - Client-side script execution
**Mitigation:**
- Strict input validation on branding fields (hex colors only, URL whitelist)
- CSP headers prevent inline script execution
- Logo/favicon URLs validated (HTTPS only, image MIME type check)
- React auto-escapes all rendered content

**Residual Risk:** LOW

---

#### Threat 5: Activity Log Tampering
**Attack Vector:** Admin attempts to delete incriminating logs
**Impact:** LOW - Loss of audit trail
**Mitigation:**
- Activity logs table has no DELETE policy (append-only)
- Service role required for inserts (users cannot insert fake logs)
- Logs stored in separate table partition (can be backed up externally)
- Timestamp generated by database (not client)

**Residual Risk:** LOW

---

#### Threat 6: Client Role Abuse
**Attack Vector:** Client role user attempts to publish posts directly
**Impact:** MEDIUM - Brand reputation risk
**Mitigation:**
- Client role has no `can_publish` permission by default
- Approval workflow enforced by RLS (client can only approve, not publish)
- Admin can disable client posting in agency settings
- Activity log shows all publish attempts

**Residual Risk:** LOW

---

### 7.3 Security Best Practices

1. **JWT Claims Management**
   - Store minimal data in JWT (user_id, email only)
   - Agency/role fetched from database on each request (fresh data)
   - No client-supplied tenant identifiers

2. **Rate Limiting**
   - Per-agency rate limits (prevent one agency from DoS)
   - Stricter limits for client role (100 req/min vs 1000 for owner)

3. **Sensitive Data Encryption**
   - Social account tokens encrypted at rest (pgcrypto)
   - Branding logo URLs validated before storage
   - No PII in activity log metadata

4. **Compliance**
   - GDPR: Agency owner can export all data, request deletion
   - SOC 2: Activity logs provide comprehensive audit trail
   - HIPAA: Not applicable (no health data)

---

## 8. Scalability Considerations

### 8.1 Performance Optimization

**Database Optimizations:**

1. **Indexes for Multi-Tenant Queries**
   ```sql
   -- Critical indexes for agency queries
   CREATE INDEX idx_brands_agency_active ON public.brands(agency_id, is_active);
   CREATE INDEX idx_posts_brand_created ON public.posts(brand_id, created_at DESC);
   CREATE INDEX idx_team_members_agency_active ON public.team_members(agency_id, status)
       WHERE status = 'active';

   -- Composite index for permission checks
   CREATE INDEX idx_brand_members_lookup ON public.brand_members(brand_id, team_member_id)
       INCLUDE (permissions);
   ```

2. **Query Optimization**
   - Denormalize brand count in agencies table (updated via trigger)
   - Cache team member permissions in session (5 min TTL)
   - Use materialized views for agency analytics dashboards

3. **Partitioning Strategy**
   - Partition `activity_logs` by created_at (monthly partitions)
   - Partition `posts` by brand_id when table exceeds 10M rows
   - Archive old activity logs to cold storage (>1 year)

**Application Optimizations:**

1. **Caching Strategy**
   - Cache agency branding (1 hour TTL, invalidate on update)
   - Cache team member list (5 min TTL)
   - Cache brand permissions per user (5 min TTL)
   - Use Redis for session-scoped cache

2. **API Response Optimization**
   - Paginate all list endpoints (default 50, max 200)
   - Use GraphQL for complex nested queries (reduce over-fetching)
   - Implement field selection (`?fields=id,name,created_at`)

3. **Frontend Performance**
   - Lazy load brand dashboard components
   - Virtual scrolling for large brand/post lists
   - Optimistic UI updates (assume success, rollback on error)

### 8.2 Scaling Thresholds

**Expected Load per Agency Tier:**

| Metric | Free | Starter | Growth | Agency | Enterprise |
|--------|------|---------|--------|--------|------------|
| Brands | 1 | 5 | 15 | 50 | 200 |
| Team Members | 1 | 1 | 3 | 10 | 50 |
| Posts/month | 10 | 100 | 500 | 2000 | 10000 |
| API calls/day | 1K | 10K | 50K | 200K | 1M |

**Database Scaling Plan:**

- **Current:** Single Postgres instance (Supabase free tier)
  - Supports: <100 agencies, <1M posts

- **Phase 1 (100-1000 agencies):** Upgrade to Supabase Pro
  - Vertical scaling (4 vCPU, 8GB RAM)
  - Read replicas for analytics queries

- **Phase 2 (1000-10000 agencies):** Horizontal scaling
  - Connection pooling (PgBouncer)
  - Separate analytics database (replicate via CDC)
  - Redis cache layer

- **Phase 3 (10000+ agencies):** Sharding
  - Shard by agency_id hash (consistent hashing)
  - Route queries to correct shard via proxy
  - Cross-shard queries handled by aggregation service

**Monitoring Metrics:**

- Database: Query latency p95 <300ms, CPU <70%, connection pool usage <80%
- API: Response time p95 <500ms, error rate <0.1%, cache hit rate >80%
- Frontend: LCP <2.5s, FID <100ms, CLS <0.1

### 8.3 Cost Optimization

**Database Storage:**
- Archive old posts (>2 years) to S3 (90% cost reduction)
- Compress activity logs (gzip) before archival
- Use Supabase Storage for media (cheaper than database BYTEA)

**Compute:**
- Auto-scale Edge Functions based on traffic
- Use Cloudflare CDN for static assets (white-label logos)
- Implement request coalescing (deduplicate identical queries)

**Estimated Monthly Cost (1000 agencies, 50K active brands):**
- Supabase Pro: $25 + compute/storage
- Cloudflare: $20 (Pro plan)
- Redis Cache: $30 (Upstash)
- Total: ~$100/month (scales with usage)

---

## 9. White-Label Implementation Details

### 9.1 Branding Configuration

**Supported Customizations:**

1. **Visual Identity**
   - Logo (header, favicon, email)
   - Primary color (buttons, links)
   - Secondary color (backgrounds, borders)
   - Typography (font family selection from pre-approved list)

2. **Domain**
   - Custom subdomain: `dashboard.agency.com`
   - Custom domain: `app.clientportal.com` (CNAME to SMGE infrastructure)
   - SSL certificate auto-provisioned via Let's Encrypt

3. **Email Branding**
   - From name: "Acme Agency" instead of "SMGE"
   - From email: `noreply@agency.com` (requires SPF/DKIM setup)
   - Email templates use agency branding

4. **UI Modifications**
   - Hide "Powered by SMGE" footer
   - Replace SMGE logo with agency logo
   - Custom login page background image

### 9.2 Domain Configuration Flow

1. **Agency configures custom domain in settings**
   ```
   Agency Settings → White-Label → Custom Domain
   Input: app.clientportal.com
   ```

2. **System generates CNAME instructions**
   ```
   Add DNS record:
   Type: CNAME
   Name: app
   Value: agencies.smge.com
   ```

3. **Agency adds DNS record at their registrar**

4. **System verifies DNS propagation**
   - Poll DNS every 5 minutes (max 72 hours)
   - Once verified, provision SSL certificate
   - Update routing table to serve agency dashboard on custom domain

5. **Routing logic**
   ```javascript
   // Middleware: Detect agency from domain
   const domain = req.headers.host;

   if (domain === 'app.smge.com') {
     // Default SMGE domain - show agency selector
     return next();
   }

   const agency = await getAgencyByCustomDomain(domain);
   if (agency) {
     // Custom domain - auto-select agency
     req.agency = agency;
     req.branding = agency.branding;
   }

   return next();
   ```

### 9.3 Client Portal Experience

**Dedicated Client View:**

- URL: `app.agency.com/client` (or custom domain)
- Branding: 100% agency branded (no SMGE references)
- Features:
  - View assigned brands only
  - Approve pending posts
  - View analytics reports
  - Download media assets
  - Submit content requests (form to agency)

**Access Control:**
- Clients cannot see team management
- Clients cannot see other clients' brands
- Clients cannot configure settings

---

## 10. Implementation Roadmap

### Phase 1: Core Multi-Tenancy (Week 1-2)
- [ ] Database schema migration (agencies, team_members, brand_members)
- [ ] Backfill existing data (create default agencies)
- [ ] Deploy RLS policies for multi-tenant isolation
- [ ] Test RLS extensively (security critical)
- [ ] Implement agency management APIs (CRUD)

### Phase 2: Team Collaboration (Week 3-4)
- [ ] Team invitation flow (email, accept/decline)
- [ ] Role-based permission system
- [ ] Brand access control (all vs specific brands)
- [ ] Activity logging system
- [ ] Team management UI (invite, edit, remove)

### Phase 3: Granular Permissions (Week 5)
- [ ] Brand-level permissions (brand_members table)
- [ ] Permission override system
- [ ] Permission guards in frontend
- [ ] Permission check helper functions
- [ ] Test all permission combinations

### Phase 4: White-Label Features (Week 6-7)
- [ ] Branding configuration (colors, logo)
- [ ] Custom domain setup flow
- [ ] DNS verification system
- [ ] SSL certificate provisioning
- [ ] Email branding templates
- [ ] White-label UI toggles

### Phase 5: Client Portal (Week 8)
- [ ] Client role implementation
- [ ] Approval workflow system
- [ ] Client dashboard UI
- [ ] Limited analytics view
- [ ] Client-facing documentation

### Phase 6: Activity Logs & Audit (Week 9)
- [ ] Activity logging triggers
- [ ] Log viewing UI (filterable, searchable)
- [ ] Export logs (CSV, JSON)
- [ ] Log retention policy (archive old logs)
- [ ] Compliance documentation

### Phase 7: Testing & QA (Week 10)
- [ ] Comprehensive security testing
- [ ] Permission matrix validation
- [ ] Performance benchmarking
- [ ] Load testing (1000 concurrent users)
- [ ] Cross-tenant isolation verification

### Phase 8: Documentation & Launch (Week 11-12)
- [ ] Admin documentation (agency setup guide)
- [ ] Team member onboarding guide
- [ ] Client portal user guide
- [ ] API documentation updates
- [ ] Migration guide for existing users
- [ ] Beta launch (select agencies)
- [ ] Full rollout

**Total Estimated Effort:** 18 hours (as per issue estimate)
**Recommended Timeline:** 12 weeks with 1 developer

---

## 11. Open Questions & Decisions Required

### 11.1 Technical Decisions

1. **White-Label Domain Routing:**
   - **Option A:** DNS CNAME to shared infrastructure (simpler, cheaper)
   - **Option B:** Dedicated infrastructure per custom domain (better isolation, higher cost)
   - **Recommendation:** Option A for MVP, offer Option B for Enterprise tier

2. **Client Approval Workflow:**
   - **Option A:** Client approves → Auto-publish (risky)
   - **Option B:** Client approves → Agency admin publishes (safer)
   - **Recommendation:** Option B by default, Option A opt-in setting

3. **Team Member Limit Enforcement:**
   - **Option A:** Hard limit (cannot invite beyond plan)
   - **Option B:** Soft limit (can invite, billing prorated)
   - **Recommendation:** Option A for simplicity

### 11.2 Product Decisions

1. **Pricing for Agency Tier:**
   - Base price: $299/month
   - Includes: 50 brands, 10 team members
   - Overage: +$5/brand/month, +$10/team member/month
   - White-label: +$100/month addon

2. **Client Seat Pricing:**
   - Separate SKU: $20/client/month
   - Clients do not count toward team member limit
   - Unlimited brands visible to client (agency controls)

3. **Trial Period:**
   - 14-day free trial for Agency tier
   - Full white-label access during trial
   - Require credit card upfront

---

## 12. Success Metrics

### 12.1 Technical Metrics

- **Performance:**
  - Agency dashboard load time: <2s
  - Permission check latency: <50ms
  - RLS query performance: <300ms p95

- **Security:**
  - Zero cross-tenant data leaks (critical)
  - Zero privilege escalation incidents
  - 100% audit log coverage for admin actions

- **Reliability:**
  - 99.9% uptime for agency features
  - Zero data loss incidents
  - <1% error rate on agency APIs

### 12.2 Product Metrics

- **Adoption:**
  - 20% of existing users upgrade to Agency tier (Month 1)
  - Average 5 brands per agency
  - Average 3 team members per agency

- **Engagement:**
  - 80% of agencies invite at least 1 team member
  - 50% of agencies use white-label branding
  - 30% of agencies set up custom domain

- **Revenue:**
  - $50K MRR from Agency tier (6 months)
  - 15% attach rate for white-label addon
  - <5% churn for Agency tier

---

## 13. References & Research

This architecture design is informed by industry best practices for multi-tenant SaaS platforms:

- [Shipping multi-tenant SaaS using Postgres Row-Level Security](https://www.thenile.dev/blog/multi-tenant-rls)
- [Multi-tenant data isolation with PostgreSQL Row Level Security | AWS Database Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Multi-Tenant Applications with RLS on Supabase | AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [White Label Social Media Management for Agencies - Postiz](https://postiz.com/blog/white-label-social-media-management)
- [Common Row-Level-Security Policies | MakerKit](https://makerkit.dev/docs/next-supabase/organizations/row-level-security)

---

## 14. Appendix

### A. SQL Migration Files Structure

```
supabase/migrations/
├── 00012_agency_features_schema.sql       # New tables
├── 00013_brands_agency_relationship.sql   # Modify existing tables
├── 00014_agency_rls_policies.sql          # RLS policies
├── 00015_agency_helper_functions.sql      # Helper functions
└── 00016_agency_data_backfill.sql         # Data migration
```

### B. API Endpoint Summary

```
Agency Management:
POST   /api/agencies
GET    /api/agencies
GET    /api/agencies/:id
PATCH  /api/agencies/:id
DELETE /api/agencies/:id

Team Management:
POST   /api/agencies/:id/team/invite
GET    /api/agencies/:id/team
PATCH  /api/agencies/:id/team/:member_id
DELETE /api/agencies/:id/team/:member_id
POST   /api/agencies/:id/team/:member_id/accept

Brand Access:
GET    /api/agencies/:id/brands
POST   /api/brands/:id/members
PATCH  /api/brands/:id/members/:member_id
DELETE /api/brands/:id/members/:member_id

Activity Logs:
GET    /api/agencies/:id/activity
GET    /api/agencies/:id/activity/export

White-Label:
GET    /api/agencies/:id/branding
PATCH  /api/agencies/:id/branding
POST   /api/agencies/:id/branding/domain/verify

Client Portal:
GET    /api/client/dashboard
GET    /api/client/brands
POST   /api/client/posts/:id/approve
```

### C. Frontend Route Structure

```
/agencies                           # Agency selector (if multiple)
/agencies/:agencyId                # Agency dashboard
/agencies/:agencyId/brands         # Brand list
/agencies/:agencyId/brands/:brandId # Brand dashboard
/agencies/:agencyId/team           # Team management
/agencies/:agencyId/settings       # Agency settings
/agencies/:agencyId/activity       # Activity logs
/agencies/:agencyId/billing        # Billing & subscription
/client                            # Client portal (dedicated route)
```

---

**Document Status:** DRAFT - Ready for Review
**Next Steps:** Review by engineering team → Approval → Implementation

**Reviewers:**
- [ ] Engineering Lead (Architecture Review)
- [ ] Security Engineer (Threat Model Review)
- [ ] Product Manager (Feature Completeness)
- [ ] DevOps (Scalability & Deployment)

---

**End of Architecture Document**
