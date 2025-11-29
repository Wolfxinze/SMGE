# Signup Flow Fix - Complete Guide

## Issues Fixed ✅

### 1. Auth Callback 404 Error
**Problem**: Supabase redirects to `/auth/callback` but route was only at `/api/auth/callback`

**Fix Applied**: Created alias route at `/app/auth/callback/route.ts` that forwards to API handler

**Status**: ✅ FIXED - Route now exists and handles callbacks properly

### 2. Email Verification "OTP Expired" Error
**Problem**: Supabase sends email confirmation links that expire quickly in local dev

**Root Cause**: Your `.env.local` has `NEXT_PUBLIC_ENABLE_EMAIL_CONFIRMATION=false` but Supabase dashboard still requires email confirmation

**Fix Required**: Disable email confirmation in Supabase dashboard

## Configuration Steps Required

### Step 1: Disable Email Confirmation in Supabase

1. **Open Supabase Dashboard**
   ```bash
   open "https://supabase.com/dashboard/project/orharllggjmfsalcshpu/auth/providers"
   ```

2. **Navigate to**: Authentication → Providers → Email

3. **Disable "Confirm email"**
   - Find the toggle for "Confirm email"
   - Turn it **OFF** for local development

4. **Save changes**

### Step 2: Test Signup Again

After disabling email confirmation:

1. **Clear browser data** (optional but recommended)
   - Chrome: Cmd+Shift+Delete → Clear cookies

2. **Navigate to signup**
   ```
   http://localhost:3000/signup
   ```

3. **Create new account**
   - Email: `test2@example.com`
   - Password: `TestPassword123!`

4. **Expected Result**
   - ✅ Account created successfully
   - ✅ Immediately signed in (no email verification)
   - ✅ Redirected to dashboard or onboarding

## Alternative: Manual Account Verification

If you prefer to keep email confirmation enabled, you can manually verify existing accounts:

### Via Supabase SQL Editor:

```sql
-- Find your user ID
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- Manually confirm email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'your-email@example.com';
```

### Via Supabase Dashboard:

1. Open: https://supabase.com/dashboard/project/orharllggjmfsalcshpu/auth/users
2. Find your user
3. Click "..." → "Confirm email"

## Current Account Status

Your account created during testing:
- ✅ Account exists in database
- ❌ Email not confirmed (OTP expired)
- 🔧 Needs manual verification OR disable email confirmation

## Testing Checklist

After applying fixes:

- [ ] Navigate to http://localhost:3000/signup
- [ ] Create account with new email
- [ ] Verify no email confirmation required
- [ ] Check immediate login after signup
- [ ] Confirm redirect to dashboard/onboarding
- [ ] Test database triggers created profile
- [ ] Test database triggers created agency

## Database Verification

After successful signup, run these checks:

```sql
-- Check user was created
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'test2@example.com';

-- Check profile was created (by trigger)
SELECT * FROM public.profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'test2@example.com');

-- Check agency was created (by trigger)
SELECT * FROM public.agencies
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'test2@example.com');

-- Check team member was created (by trigger)
SELECT * FROM public.team_members
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test2@example.com');
```

Expected:
- ✅ 1 user record
- ✅ 1 profile record
- ✅ 1 agency record
- ✅ 1 team_member record (role: 'owner')

## Files Modified

1. **Created**: `/app/auth/callback/route.ts`
   - Alias route to fix 404 error
   - Forwards callbacks to API handler

2. **Existing** (already fixed): `/supabase/migrations/00014_fix_signup_error_handling.sql`
   - Error handling in triggers
   - Prevents signup failures from database issues

## Production Configuration

For production deployment:

1. **Enable email confirmation** in Supabase dashboard
2. **Configure email provider** (Supabase SMTP or custom)
3. **Set proper redirect URLs**:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/api/auth/callback`
4. **Update** `.env.production`:
   ```
   NEXT_PUBLIC_ENABLE_EMAIL_CONFIRMATION=true
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```

## Quick Commands

### Test signup via browser:
```bash
open "http://localhost:3000/signup"
```

### Check Supabase auth settings:
```bash
open "https://supabase.com/dashboard/project/orharllggjmfsalcshpu/auth/providers"
```

### View users in dashboard:
```bash
open "https://supabase.com/dashboard/project/orharllggjmfsalcshpu/auth/users"
```

## Summary

**What's Working**:
- ✅ Signup form submits successfully
- ✅ User account created in database
- ✅ Auth callback route now exists (no more 404)
- ✅ Database triggers fire correctly
- ✅ Error handling prevents crashes

**What Needs Configuration**:
- 🔧 Disable email confirmation in Supabase dashboard for local dev
- 🔧 OR manually verify existing test accounts

**After Configuration**:
- ✅ Users can sign up and immediately access the app
- ✅ No email verification required in development
- ✅ Full signup flow works end-to-end
