# Database Migration Guide

## Current Status
✅ **Migration 00001** already applied (profiles, social_accounts, _health tables exist)
❌ **Migrations 00002-00011** need to be applied

## Migration Application Steps

Since Supabase CLI login is not available in this environment, apply migrations manually via SQL Editor.

### Step 1: Access SQL Editor
Go to: https://app.supabase.com/project/orharllggjmfsalcshpu/sql/new

### Step 2: Apply Each Migration in Order

Run these migrations **one at a time** in the SQL Editor:

#### ✅ Migration 00002: Auth Schema
**File:** `supabase/migrations/00002_auth_schema.sql`
**What it does:**
- Auto-creates user profiles on signup
- Adds auth helper functions
- Adds: `last_sign_in_at`, `email_verified`, `auth_metadata`, `onboarding_completed` columns

**To apply:**
1. Open file: `supabase/migrations/00002_auth_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00003: Brand Brain Schema
**File:** `supabase/migrations/00003_brand_brain_schema.sql`
**What it does:**
- Creates Brand Brain core tables: `brands`, `brand_voice`, `brand_examples`, `brand_guidelines`
- Enables pgvector extension for embeddings
- Comprehensive RLS policies

**To apply:**
1. Open file: `supabase/migrations/00003_brand_brain_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00004: Rate Limiting
**File:** `supabase/migrations/00004_rate_limiting.sql`
**What it does:**
- Creates `rate_limits` table for API rate limiting
- Database-backed rate limiting system

**To apply:**
1. Open file: `supabase/migrations/00004_rate_limiting.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00005: Post Generator Base
**File:** `supabase/migrations/00005_post_generator_base.sql`
**What it does:**
- Creates core post generator tables
- Platform-specific post templates

**To apply:**
1. Open file: `supabase/migrations/00005_post_generator_base.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00006: Post Generator Schema
**File:** `supabase/migrations/00006_post_generator_schema.sql`
**What it does:**
- Extends post generator with full schema
- Post versioning and approval workflows

**To apply:**
1. Open file: `supabase/migrations/00006_post_generator_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00007: Engagement Agent
**File:** `supabase/migrations/00007_engagement_agent.sql`
**What it does:**
- Creates engagement queue and response tables
- AI-powered engagement agent infrastructure

**To apply:**
1. Open file: `supabase/migrations/00007_engagement_agent.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00008: Engagement Agent Schema
**File:** `supabase/migrations/00008_engagement_agent_schema.sql`
**What it does:**
- Full engagement agent schema
- Engagement metrics and tracking

**To apply:**
1. Open file: `supabase/migrations/00008_engagement_agent_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00009: Payment & Subscription Schema
**File:** `supabase/migrations/00009_payment_subscription_schema.sql`
**What it does:**
- Stripe integration tables
- Subscription management
- Payment history tracking

**To apply:**
1. Open file: `supabase/migrations/00009_payment_subscription_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00010: Social Scheduler Schema
**File:** `supabase/migrations/00010_social_scheduler_schema.sql`
**What it does:**
- Post scheduling infrastructure
- Queue management for scheduled posts
- Multi-platform publishing support

**To apply:**
1. Open file: `supabase/migrations/00010_social_scheduler_schema.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

#### ✅ Migration 00011: Free Tier Initialization
**File:** `supabase/migrations/00011_free_tier_initialization.sql`
**What it does:**
- Sets up free tier limits
- Initializes default quotas
- Usage tracking for free users

**To apply:**
1. Open file: `supabase/migrations/00011_free_tier_initialization.sql`
2. Copy entire content
3. Paste in SQL Editor
4. Click "Run"

---

### Step 3: Verify Migrations Applied

After all migrations are complete, check your database tables:

Expected tables after all migrations:
- `_health`
- `profiles`
- `social_accounts`
- `brands`
- `brand_voice`
- `brand_examples`
- `brand_guidelines`
- `rate_limits`
- `posts`
- `post_versions`
- `engagement_queue`
- `engagement_responses`
- `subscriptions`
- `payments`
- `scheduled_posts`
- `scheduled_queue`
- And more...

### Step 4: Generate TypeScript Types

After all migrations are applied, generate TypeScript types:

**Option 1: Using Supabase CLI (Recommended)**
```bash
# Login to Supabase CLI first (one-time setup)
supabase login

# Generate types from your database schema
mkdir -p lib/db
supabase gen types typescript --project-id orharllggjmfsalcshpu > lib/db/types.ts
```

**Option 2: Using Supabase Dashboard**
1. Go to: https://app.supabase.com/project/orharllggjmfsalcshpu/api
2. Scroll to "Generated Types" section
3. Click "Generate Types"
4. Copy the generated TypeScript code
5. Create `lib/db/types.ts` and paste the code

**Option 3: Using Access Token**
```bash
# Set access token from https://app.supabase.com/account/tokens
export SUPABASE_ACCESS_TOKEN='your-access-token'

# Generate types
mkdir -p lib/db
supabase gen types typescript --project-id orharllggjmfsalcshpu > lib/db/types.ts
```

This will resolve the ~90 TypeScript errors in the codebase.

---

## Troubleshooting

### If a migration fails:
1. Read the error message carefully
2. Check if the object already exists (safe to ignore)
3. If it's a syntax error, check the SQL file for issues
4. Contact support if blocked

### Common Error: "must be owner of relation users"

**Error Example:**
```
ERROR: 42501: must be owner of relation users
```

**Root Cause:**
- Migration attempts to create trigger on `auth.users` table
- Supabase auth schema is system-managed and cannot be modified
- You don't have ownership permissions on `auth.users`

**Solution:**
- Use `public.profiles` table instead (you own this)
- Profiles are auto-created via trigger from migration 00002
- Free tier initialization triggers on profile creation, not user creation

**Example:**
```sql
-- ❌ WRONG - Cannot create trigger on auth.users
CREATE TRIGGER my_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION my_function();

-- ✅ CORRECT - Create trigger on public.profiles
CREATE TRIGGER my_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION my_function();
```

**Fix Applied:**
- Commit e4e4f5e fixed migration 00011 to use profiles trigger

---

### Common Error: "column X does not exist" during CREATE TABLE

**Error Example:**
```
ERROR: 42703: column "social_account_id" does not exist
```

**Root Cause:**
- Migration was previously run partially, creating tables with incomplete schema
- When re-running with `CREATE TABLE IF NOT EXISTS`, PostgreSQL skips table creation
- But then tries to validate foreign key constraints on columns that don't exist in the partial table

**Solution:**
- Migration 00008 uses `DROP TABLE IF EXISTS CASCADE` before `CREATE TABLE`
- This ensures tables are always created with correct schema
- Other affected migrations may need the same pattern

**How to identify:**
1. Error says "column does not exist" during CREATE TABLE (not during INSERT/UPDATE)
2. Table already exists from previous partial migration
3. Run diagnostic: `SELECT * FROM information_schema.columns WHERE table_name = 'your_table';`

**Fix Applied:**
- Commit f97d430 fixed migration 00008 with this pattern
- Commit 6de165b fixed migration 00010 with this pattern

### Migration Safety:
✅ **All migrations (00001-00011) are now fully idempotent and safe to re-run!**

All migrations use these safe patterns:
- `CREATE OR REPLACE FUNCTION` (safe to re-run)
- `CREATE TABLE IF NOT EXISTS` (safe to re-run)
- `DROP TABLE IF EXISTS CASCADE` before `CREATE TABLE` (when table might exist from partial migration - see migration 00008)
- `CREATE INDEX IF NOT EXISTS` (safe to re-run - fixed in commit 5b87adf)
- `DROP POLICY IF EXISTS` before `CREATE POLICY` (safe to re-run - fixed in commit 5b87adf)
- `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` (safe to re-run - fixed in commit 5b87adf)
- Conditional column additions with `DO $$ BEGIN ... END $$;`

**Validation:** Run `bash validate-migrations.sh` to verify idempotency

**Special Note on Migrations 00008 and 00010:**
- Use `DROP TABLE IF EXISTS CASCADE` instead of `CREATE TABLE IF NOT EXISTS`
- This handles partial migrations where tables exist with incomplete/wrong schema
- Without DROP, PostgreSQL would skip CREATE but then fail on foreign key validation
- Migration 00008 fixed in commit f97d430
- Migration 00010 fixed in commit 6de165b

### If you need to reset:
**⚠️ WARNING: This deletes ALL data!**
```sql
-- Only use in development if you need a fresh start
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
-- Then re-run all migrations 00001-00011
```

---

## Next Steps After Migrations

1. ✅ Generate TypeScript types
2. ✅ Restart development server to pick up new secrets
3. ✅ Test build: `npm run build`
4. ✅ Choose next epic direction (Analytics, Agency Features, or MVP Testing)
