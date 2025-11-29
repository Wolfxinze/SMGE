# Testing Guide - Analytics Dashboard & Agency Features

## Prerequisites
✅ All 13 migrations applied to staging
✅ TypeScript types regenerated
✅ Build passes successfully
✅ Dev server running on http://localhost:3001

---

## Testing Steps

### Step 1: Create a Test User

1. **Open the app** in your browser:
   ```
   http://localhost:3001/signup
   ```

2. **Sign up with a test account:**
   - Email: `test@example.com`
   - Password: `TestPassword123!`

3. **Verify signup successful** - You should be redirected to the dashboard

---

### Step 2: Create Sample Data

Run this in **Supabase SQL Editor**:

```bash
# Open SQL Editor
open "https://supabase.com/dashboard/project/orharllggjmfsalcshpu/sql/new"
```

**Copy and paste** the contents of:
```
supabase/scripts/create-test-data.sql
```

**Click "Run"**

**Expected Output:**
- ✅ Users: 1
- ✅ Brands: 1
- ✅ Posts: 20
- ✅ Agencies: 1 (auto-created)
- ✅ Team members: 1 (owner)

---

### Step 3: Test Analytics Dashboard

#### 3a. Test via SQL (Backend)

In Supabase SQL Editor, run:
```
supabase/scripts/analytics-test-queries.sql
```

**Expected Results:**
- ✅ Dashboard analytics returns data
- ✅ Post analytics works
- ✅ Content insights generated
- ✅ All queries < 50ms

#### 3b. Test via Browser (Frontend)

1. **Navigate to Analytics Dashboard:**
   ```
   http://localhost:3001/analytics
   ```

2. **Verify Elements Visible:**
   - [ ] Brand selector dropdown
   - [ ] Date range buttons (7/30/90/365 days)
   - [ ] 4 metric cards (Posts, Reach, Impressions, Engagement)
   - [ ] Engagement trend chart
   - [ ] Platform comparison chart
   - [ ] Top posts table
   - [ ] "Generate Insights" button

3. **Test Interactions:**
   - [ ] Change date range → metrics update
   - [ ] Click "Generate Insights" → AI insights appear
   - [ ] Check browser console → no errors

4. **Take Screenshot** for documentation

---

### Step 4: Test Agency Features

In Supabase SQL Editor, run:
```
supabase/scripts/agency-features-tests.sql
```

**Expected Results:**

✅ **TEST 1:** Auto-agency created for user
✅ **TEST 2:** Team member (owner) created
✅ **TEST 3:** Brand linked to agency
✅ **TEST 4:** Permissions view populated
✅ **TEST 5:** RLS policies enabled
✅ **TEST 6:** Role hierarchy correct
✅ **TEST 7:** Activity logs functional
✅ **TEST 8:** Performance < 50ms
✅ **TEST 9:** Team invitations work
✅ **TEST 10:** Cross-tenant isolation verified

---

### Step 5: Performance Verification

Check the `EXPLAIN ANALYZE` outputs from Step 4:

**Target Benchmarks:**
- Brand list query: **< 50ms** ✅
- Permission checks: **< 10ms** ✅
- Dashboard analytics: **< 50ms** ✅
- Activity log writes: **< 100ms** ✅

---

### Step 6: Security Testing

#### Test RLS Policies

1. **Create a second test user:**
   - Sign up with: `test2@example.com`

2. **In SQL Editor, verify isolation:**
```sql
-- As test2@example.com, try to access test@example.com's data
SET LOCAL "request.jwt.claims" = '{"sub": "<test2-user-id>"}';

SELECT * FROM public.agencies; -- Should only see test2's agency
SELECT * FROM public.brands; -- Should only see test2's brands
```

**Expected:** ✅ No cross-tenant data visible

---

## Test Checklist

### Analytics Dashboard
- [ ] SQL functions return correct data
- [ ] Frontend dashboard loads without errors
- [ ] All charts render correctly
- [ ] Date range filtering works
- [ ] AI insights generation works
- [ ] Performance < 2s page load
- [ ] No console errors
- [ ] Responsive on mobile

### Agency Features
- [ ] Auto-agency created on signup
- [ ] Team member (owner) created
- [ ] Brands automatically linked
- [ ] Permissions view accurate
- [ ] RLS policies active
- [ ] Cross-tenant isolation verified
- [ ] Activity logs working
- [ ] Performance benchmarks met
- [ ] Team invitations functional

### Build & Deploy
- [ ] TypeScript compiles (0 errors)
- [ ] All 39 pages generate
- [ ] No React warnings
- [ ] Dev server runs smoothly

---

## Troubleshooting

### Issue: "No data" on Analytics Dashboard

**Solution:**
1. Verify test data created: `SELECT COUNT(*) FROM posts;`
2. Check brand_id matches: `SELECT id FROM brands LIMIT 1;`
3. Ensure posts have `published_at` dates

### Issue: RLS Policy Errors

**Solution:**
1. Verify RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
2. Check policies exist: `SELECT * FROM pg_policies WHERE schemaname='public';`
3. Ensure user authenticated: `SELECT auth.uid();`

### Issue: Performance Slow

**Solution:**
1. Check indexes: `SELECT * FROM pg_indexes WHERE schemaname='public';`
2. Verify materialized view refreshed
3. Run `ANALYZE` on tables

---

## Success Criteria

**Ready to close issues when:**

✅ All SQL test scripts pass
✅ Analytics dashboard functional in browser
✅ Agency features verified
✅ Performance targets met
✅ Security isolation confirmed
✅ No errors in console/logs
✅ Build passes
✅ Screenshots captured

---

## Next Steps After Testing

1. **Document Results:**
   - Update `DEPLOYMENT_SUMMARY_2025-11-27.md`
   - Capture screenshots
   - Note any issues

2. **Close GitHub Issues:**
   - Issue #11 (Analytics Dashboard) ✅
   - Issue #8 (Agency Features Phase 1) ✅

3. **Prepare for Production:**
   - Review test results
   - Get sign-off
   - Schedule production deployment

---

## Quick Test Commands

### Verify Schema
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

### Check Data
```sql
SELECT 'Users' as type, COUNT(*)::text as count FROM auth.users
UNION ALL
SELECT 'Brands', COUNT(*)::text FROM public.brands
UNION ALL
SELECT 'Posts', COUNT(*)::text FROM public.posts
UNION ALL
SELECT 'Agencies', COUNT(*)::text FROM public.agencies;
```

### Test Analytics Function
```sql
SELECT * FROM public.get_dashboard_analytics(
    '<brand-id>',
    NOW() - INTERVAL '30 days',
    NOW()
);
```

---

## Contact

Questions? Check:
- [DEPLOYMENT_SUMMARY_2025-11-27.md](DEPLOYMENT_SUMMARY_2025-11-27.md)
- [.claude/architecture/agency-features-migration-testing.md](.claude/architecture/agency-features-migration-testing.md)
- [GitHub Issues](https://github.com/Wolfxinze/SMGE/issues)
