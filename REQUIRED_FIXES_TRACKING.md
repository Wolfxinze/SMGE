# Required Fixes - Action Items from Retroactive Code Review

**Source:** CODE_REVIEW_RETROACTIVE.md
**Date:** 2025-11-28
**Priority:** Create GitHub issues for tracking

---

## GitHub Issues to Create

### Issue 1: 🔴 CRITICAL - Fix RLS Security Vulnerabilities in Migration 00014

**Title:** Security: Remove RLS bypass policies that allow privilege escalation

**Description:**
Migration 00014 introduces security vulnerabilities by creating blanket INSERT policies with `WITH CHECK (true)`. These policies allow any authenticated user to insert records into profiles, agencies, team_members, and subscriptions tables.

**Attack Vector:**
```javascript
// Any user can create admin profiles
await supabase.from('profiles').insert({
  id: 'victim-uuid',
  role: 'admin'
})
```

**Fix:**
- Remove policies: "Triggers can insert profiles", "Triggers can insert agencies", etc.
- Rely on `SECURITY DEFINER` functions to bypass RLS safely
- Verify trigger functions already have SECURITY DEFINER (they do)
- Test signup flow still works after policy removal

**Files:**
- `/Users/laiyama/Project/SMGE/supabase/migrations/00014_fix_signup_error_handling.sql` (lines 162-187)

**Acceptance Criteria:**
- [ ] All `WITH CHECK (true)` policies removed
- [ ] Signup flow still works (create test user)
- [ ] Cannot insert profiles/agencies as different user (security test)
- [ ] Migration remains idempotent

**Labels:** security, critical, database, migration
**Priority:** P0 - Production Blocker

---

### Issue 2: 🔴 CRITICAL - Add Input Validation to SECURITY DEFINER Functions

**Title:** Security: Add input validation to team_members RLS helper functions

**Description:**
Functions in migration 00015 are `SECURITY DEFINER` but lack input validation. This is dangerous as these functions run with elevated privileges.

**Vulnerability:**
- NULL parameters could cause unexpected behavior
- search_path attacks possible without SET search_path
- No bounds checking on array parameters

**Fix:**
Add validation to all three functions:
- `is_agency_owner(p_agency_id UUID, p_user_id UUID)`
- `is_team_member_with_role(p_agency_id UUID, p_user_id UUID, p_roles TEXT[])`
- `is_active_team_member(p_agency_id UUID, p_user_id UUID)`

**Template:**
```sql
CREATE FUNCTION public.is_agency_owner(p_agency_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validate inputs
    IF p_agency_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.agencies
        WHERE id = p_agency_id AND owner_id = p_user_id
    );
END;
$$;
```

**Files:**
- `/Users/laiyama/Project/SMGE/supabase/migrations/00015_fix_team_members_rls_recursion.sql` (lines 28-80)

**Acceptance Criteria:**
- [ ] All three functions have NULL checks
- [ ] All functions use `SET search_path = public`
- [ ] Array parameter validated (not empty, reasonable size)
- [ ] Tests verify NULL parameters return FALSE safely

**Labels:** security, critical, database, migration
**Priority:** P0 - Production Blocker

---

### Issue 3: 🔴 CRITICAL - Add Authentication Guards to Posts UI

**Title:** Security: Add user authentication checks before database queries

**Description:**
Posts pages (`/posts` and `/posts/[id]`) perform database queries without verifying user authentication. While RLS provides protection, defense-in-depth requires explicit checks.

**Files Affected:**
- `/Users/laiyama/Project/SMGE/app/(dashboard)/posts/page.tsx`
- `/Users/laiyama/Project/SMGE/app/(dashboard)/posts/[id]/page.tsx`

**Required Changes:**

1. **Posts List:** Add auth check in fetchPosts
```typescript
const fetchPosts = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.push('/auth/signin');
    return;
  }
  // ... rest of fetch
}
```

2. **Post Editor:** Add ownership verification in handleSave and handleDelete
```typescript
const handleSave = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || post.user_id !== user.id) {
    setError('Unauthorized');
    return;
  }
  // ... rest of save
}
```

**Acceptance Criteria:**
- [ ] fetchPosts verifies user before query
- [ ] handleSave verifies ownership before update
- [ ] handleDelete verifies ownership before delete
- [ ] Unauthorized attempts show error message
- [ ] Tests verify auth checks work

**Labels:** security, critical, frontend, authentication
**Priority:** P0 - Production Blocker

---

### Issue 4: 🔴 CRITICAL - Write Security Integration Tests

**Title:** Testing: Add security tests for RLS and authentication

**Description:**
No tests exist for the new UI pages or migrations. Security-critical code requires test coverage.

**Required Test Coverage:**

1. **Migration Tests:**
```sql
-- Test user cannot insert profile for different user
-- Test user cannot create agency for different owner
-- Test SECURITY DEFINER functions handle NULL safely
```

2. **UI Tests:**
```typescript
// Test unauthenticated users cannot access posts
// Test users cannot edit others' posts
// Test RLS prevents cross-user data access
```

**Files to Create:**
- `supabase/migrations/__tests__/00014_security.test.sql`
- `supabase/migrations/__tests__/00015_security.test.sql`
- `app/(dashboard)/posts/__tests__/page.test.tsx`
- `app/(dashboard)/posts/[id]/__tests__/page.test.tsx`

**Acceptance Criteria:**
- [ ] Tests verify RLS policies work correctly
- [ ] Tests verify privilege escalation is prevented
- [ ] Tests verify UI auth checks work
- [ ] All tests pass
- [ ] Coverage > 80% for new code

**Labels:** testing, critical, security
**Priority:** P0 - Production Blocker

---

### Issue 5: 🔴 CRITICAL - Fix Server-Side Auth Redirect Caching

**Title:** Fix: Prevent auth redirect caching in dashboard server component

**Description:**
Dashboard page (`app/dashboard/page.tsx`) uses server-side redirect without proper cache control. This can cause:
- CDN caching of redirects
- Browser caching issues
- Redirect loops

**Fix:**
```typescript
import { headers } from 'next/headers';
import { RedirectType } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth/signin', RedirectType.replace);
  }

  // Set no-cache headers
  headers().set('Cache-Control', 'no-store, must-revalidate');

  // ... rest of page
}
```

**Files:**
- `/Users/laiyama/Project/SMGE/app/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] Redirect uses RedirectType.replace
- [ ] Cache-Control headers set
- [ ] Test: Sign out → redirect → sign in → no loop
- [ ] Test: Verify headers in network tab

**Labels:** bug, critical, authentication, caching
**Priority:** P0 - Production Blocker

---

### Issue 6: 🟡 IMPORTANT - Replace Silent Error Suppression in Migration 00014

**Title:** Fix: Replace EXCEPTION WHEN OTHERS with proper error handling

**Description:**
Migration 00014 uses `EXCEPTION WHEN OTHERS` with only `RAISE WARNING`, hiding critical setup failures. This creates orphaned auth records when profile/agency/subscription creation fails.

**Problem:**
```sql
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error...';  -- User never sees this
END;
```

**Better Approach:**
```sql
EXCEPTION
    WHEN unique_violation THEN
        -- Handle known safe conditions
        UPDATE ... ;
    -- Let other errors propagate and fail transaction
END;
```

**Files:**
- `/Users/laiyama/Project/SMGE/supabase/migrations/00014_fix_signup_error_handling.sql`

**Acceptance Criteria:**
- [ ] Only handle specific known exceptions
- [ ] Unknown errors propagate (fail signup transaction)
- [ ] Test: Simulate FK violation → transaction rolls back
- [ ] Test: Successful signup creates all records atomically

**Labels:** bug, important, database, error-handling
**Priority:** P1 - Should Fix Soon

---

### Issue 7: 🟡 IMPORTANT - Fix React useEffect Dependencies and Cleanup

**Title:** Fix: Add useEffect cleanup and fix dependency arrays

**Description:**
Posts pages have React issues:
1. Missing cleanup in useEffect (memory leaks)
2. Missing dependencies causing stale closures
3. State updates on unmounted components

**Files:**
- `/Users/laiyama/Project/SMGE/app/(dashboard)/posts/page.tsx`
- `/Users/laiyama/Project/SMGE/app/(dashboard)/analytics/page.tsx`

**Fix Template:**
```typescript
useEffect(() => {
  let cancelled = false;

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetch();
      if (!cancelled) {
        setData(data);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    cancelled = true;
  };
}, [/* all dependencies */]);
```

**Acceptance Criteria:**
- [ ] All useEffect have cleanup functions
- [ ] No React warnings about dependencies
- [ ] Test: Navigate away during load → no errors
- [ ] Test: Rapid filter changes → no race conditions

**Labels:** bug, important, frontend, react
**Priority:** P1 - Should Fix Soon

---

### Issue 8: 🟡 IMPORTANT - Add User-Facing Error Messages

**Title:** UX: Show error messages to users when operations fail

**Description:**
All UI pages log errors to console but never show them to users. Users see empty states or loading spinners forever.

**Required Changes:**
1. Add error state to all components
2. Show errors in Alert components
3. Provide actionable error messages

**Example:**
```typescript
const [error, setError] = useState<string | null>(null);

// In catch blocks:
setError(error instanceof Error ? error.message : 'Failed to load data');

// In render:
{error && (
  <Alert variant="destructive">
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

**Files:**
- All files in `app/(dashboard)/posts/`
- `app/(dashboard)/analytics/page.tsx`

**Acceptance Criteria:**
- [ ] Error state added to all components
- [ ] Errors shown in UI (not just console)
- [ ] Error messages are user-friendly
- [ ] Errors clear when retry succeeds

**Labels:** ux, important, frontend
**Priority:** P1 - Should Fix Soon

---

### Issue 9: 🟡 IMPORTANT - Replace window.confirm with Accessible Dialog

**Title:** A11y: Replace window.confirm with accessible confirmation dialog

**Description:**
Post editor uses `window.confirm()` for delete confirmation. This is:
- Not accessible (screen reader issues)
- Can't be styled
- Poor mobile UX
- Blocks JavaScript thread

**Replace with:**
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, ... } from '@/components/ui/alert-dialog';

const [showDeleteDialog, setShowDeleteDialog] = useState(false);

<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogTitle>Delete Post</AlertDialogTitle>
    <AlertDialogDescription>
      This action cannot be undone.
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDeleteConfirmed}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Files:**
- `/Users/laiyama/Project/SMGE/app/(dashboard)/posts/[id]/page.tsx`

**Acceptance Criteria:**
- [ ] window.confirm removed
- [ ] AlertDialog component used
- [ ] Keyboard navigation works
- [ ] Screen reader announces dialog
- [ ] Works on mobile

**Labels:** accessibility, important, frontend, ux
**Priority:** P1 - Should Fix Soon

---

### Issue 10: 🟡 IMPORTANT - Add Database Indexes for Performance

**Title:** Performance: Add missing indexes to optimize queries

**Description:**
Missing indexes on frequently queried columns will cause slow queries as data grows.

**Required Indexes:**
```sql
-- Profiles queried by id in triggers
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles(id)
  WHERE id IS NOT NULL;

-- Subscriptions queried by user_id and status
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions(user_id, status)
  WHERE status = 'active';

-- Posts queried by user_id and status
CREATE INDEX IF NOT EXISTS idx_posts_user_status
  ON public.posts(user_id, status);

-- Posts ordered by created_at
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts(created_at DESC);
```

**Create Migration:**
- `supabase/migrations/00016_add_performance_indexes.sql`

**Acceptance Criteria:**
- [ ] Migration created and tested
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] Query performance improved (measure with pgbench)
- [ ] Migration is idempotent (IF NOT EXISTS)

**Labels:** performance, important, database
**Priority:** P1 - Should Fix Soon

---

### Issue 11: 🟡 IMPORTANT - Generate TypeScript Types from Supabase Schema

**Title:** DX: Generate TypeScript types from database schema

**Description:**
All database queries use manually maintained interfaces. This causes type drift when schema changes.

**Solution:**
```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

**Integration:**
```typescript
import type { Database } from '@/lib/database.types';

const supabase = createClient<Database>();

// Now fully typed
const { data } = await supabase
  .from('posts')
  .select('*');  // data is Post[] with correct types
```

**Acceptance Criteria:**
- [ ] Types generated from schema
- [ ] All queries updated to use generated types
- [ ] No TypeScript errors
- [ ] Add script to package.json: `"db:types": "supabase gen types..."`
- [ ] Document in README when to regenerate

**Labels:** developer-experience, important, typescript
**Priority:** P1 - Should Fix Soon

---

### Issue 12: 🟢 IMPROVEMENT - Fix Analytics Refresh Button

**Title:** Fix: Make analytics refresh button work reliably

**Description:**
Current refresh implementation may not trigger re-render:
```typescript
const handleRefresh = () => {
  setRefreshing(true);
  setDateRange(dateRange);  // Same value - may not re-render
};
```

**Better Options:**

Option A: Direct call
```typescript
const handleRefresh = () => {
  setRefreshing(true);
  fetchAnalytics();
};
```

Option B: Refresh counter
```typescript
const [refreshCounter, setRefreshCounter] = useState(0);

const handleRefresh = () => {
  setRefreshing(true);
  setRefreshCounter(c => c + 1);
};

useEffect(() => {
  fetchAnalytics();
}, [selectedBrandId, dateRange, refreshCounter]);
```

**Files:**
- `/Users/laiyama/Project/SMGE/app/(dashboard)/analytics/page.tsx`

**Acceptance Criteria:**
- [ ] Refresh button always triggers re-fetch
- [ ] Loading state shows during refresh
- [ ] Test: Click refresh 3x rapidly → all complete

**Labels:** bug, enhancement, frontend
**Priority:** P2 - Nice to Have

---

### Issue 13: 🟢 IMPROVEMENT - Implement Real Dashboard Stats

**Title:** Feature: Replace hardcoded dashboard stats with real data

**Description:**
Dashboard shows hardcoded zeros for all stats:
```typescript
<div className="text-3xl font-bold">0</div>  // Placeholder
```

**Implementation:**
1. Fetch user's posts count
2. Fetch scheduled posts count
3. Calculate total reach (sum from analytics)
4. Calculate avg engagement rate

**SQL Queries Needed:**
```sql
-- Total posts
SELECT COUNT(*) FROM posts WHERE user_id = $1;

-- Scheduled posts
SELECT COUNT(*) FROM posts
WHERE user_id = $1 AND status = 'scheduled';

-- Total reach (from analytics table - to be created)
SELECT SUM(reach) FROM post_analytics
JOIN posts ON posts.id = post_analytics.post_id
WHERE posts.user_id = $1;
```

**Files:**
- `/Users/laiyama/Project/SMGE/app/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] Stats fetch real data from database
- [ ] Stats update when data changes
- [ ] Loading states during fetch
- [ ] Errors handled gracefully

**Labels:** enhancement, frontend, dashboard
**Priority:** P2 - Nice to Have

---

### Issue 14: 🟢 IMPROVEMENT - Document Data Fetching Architecture

**Title:** Docs: Document when to use SSR vs CSR for data fetching

**Description:**
Codebase mixes Server Components and Client Components without clear pattern:
- Dashboard: Server Component
- Posts: Client Component
- Analytics: Client Component

**Create Documentation:**
File: `docs/architecture/data-fetching.md`

**Content:**
```markdown
# Data Fetching Architecture

## Server Components (SSR)
Use for:
- Initial page load with stable data
- SEO-critical content
- Public pages
- Data that doesn't change per user interaction

Examples: User profile, settings page, public blog

## Client Components (CSR)
Use for:
- Interactive real-time data
- User-triggered updates
- Frequent polling/refresh
- Complex client-side state

Examples: Posts list, analytics dashboard, chat

## Decision Tree
1. Does it need interactivity? → Client
2. Is it SEO critical? → Server
3. Does it change frequently? → Client
4. Default → Server (better performance)
```

**Acceptance Criteria:**
- [ ] Document created
- [ ] Examples added
- [ ] Current pages categorized
- [ ] Linked from main README

**Labels:** documentation, architecture
**Priority:** P2 - Nice to Have

---

## Priority Summary

### 🔴 P0 - Production Blockers (MUST FIX)
- Issue 1: RLS security vulnerabilities
- Issue 2: SECURITY DEFINER validation
- Issue 3: Authentication guards
- Issue 4: Security tests
- Issue 5: Auth redirect caching

**Estimated Total:** 8-12 hours

### 🟡 P1 - Should Fix Soon
- Issue 6: Error handling in migrations
- Issue 7: React cleanup and dependencies
- Issue 8: User-facing error messages
- Issue 9: Accessible dialogs
- Issue 10: Database indexes
- Issue 11: Generated TypeScript types

**Estimated Total:** 12-16 hours

### 🟢 P2 - Nice to Have
- Issue 12: Analytics refresh
- Issue 13: Real dashboard stats
- Issue 14: Architecture docs

**Estimated Total:** 4-6 hours

---

## Next Steps

1. **Create GitHub issues** from this document
2. **Fix P0 blockers** before any production deployment
3. **Schedule P1 fixes** in next sprint
4. **Enforce code review workflow** going forward

**No code reaches main without review. Period.**
