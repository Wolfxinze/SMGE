# Generate Database Types - Step-by-Step Instructions

## Current Issue
TypeScript build fails with error:
```
Type error: Argument of type '{ p_brand_id: string; p_days: number; }' is not assignable to parameter of type 'undefined'.
```

**Root Cause:** Missing `lib/db/types.ts` file with database type definitions.

---

## Solution: Generate Types (Choose One Method)

### ✅ Method 1: Supabase Dashboard (Easiest - Recommended)

**Step 1:** Navigate to your API page
```
https://app.supabase.com/project/orharllggjmfsalcshpu/api
```

**Step 2:** Scroll down to find "Generated Types" section

**Step 3:** Click "Generate Types" button

**Step 4:** Copy the entire generated TypeScript code

**Step 5:** Create the file and paste
```bash
# The lib/db directory already exists, just create the types file
open -a "Visual Studio Code" lib/db/types.ts
# Or use any text editor and paste the copied code
```

**Step 6:** Verify the fix
```bash
npm run build
```

---

### Method 2: Using Supabase CLI

**Prerequisites:** Supabase CLI must be logged in first

**Step 1:** Login to Supabase CLI
```bash
# Option A: Interactive browser login
supabase login

# Option B: Using access token
# Get token from: https://supabase.com/dashboard/account/tokens
supabase login --token sbp_your_token_here
```

**Step 2:** Generate types
```bash
supabase gen types typescript --project-id orharllggjmfsalcshpu > lib/db/types.ts
```

**Step 3:** Verify the fix
```bash
npm run build
```

---

### Method 3: Using Environment Variable (For Automation)

```bash
# Set access token (get from https://supabase.com/dashboard/account/tokens)
export SUPABASE_ACCESS_TOKEN='sbp_your_token_here'

# Generate types
supabase gen types typescript --project-id orharllggjmfsalcshpu > lib/db/types.ts

# Verify
npm run build
```

---

## What This File Contains

The `lib/db/types.ts` file will include TypeScript definitions for:

### Tables
- `profiles` - User profile data
- `social_accounts` - OAuth social media accounts
- `brands` - Brand configuration and settings
- `brand_voice`, `brand_examples`, `brand_guidelines` - Brand Brain data
- `posts` - Generated social media content
- `scheduled_posts` - Post scheduling queue
- `engagement_items` - Incoming comments/DMs
- `generated_responses` - AI-generated replies
- `subscriptions` - User subscription tiers
- `usage_metrics` - Usage tracking
- And more...

### Functions
- `get_engagement_analytics` - Engagement metrics (fixes current error!)
- `get_approval_queue` - Pending responses queue
- `approve_response` - Approve AI responses
- `get_posts_due_for_publishing` - Scheduler queue
- And more...

### Enums & Types
- Platform types: `instagram | twitter | linkedin | tiktok | facebook`
- Status enums: `draft | scheduled | published | failed`
- All column types and constraints

---

## Expected Outcome

✅ **Before:**
```typescript
// TypeScript error: parameters not recognized
const { data } = await supabase.rpc('get_engagement_analytics', {
  p_brand_id: brandId,
  p_days: days,
}); // ❌ Type error
```

✅ **After:**
```typescript
// Fully typed with autocomplete
const { data } = await supabase.rpc('get_engagement_analytics', {
  p_brand_id: brandId,  // ✅ Type: string
  p_days: days,         // ✅ Type: number
}); // ✅ No errors, full IntelliSense
```

---

## Troubleshooting

### "Cannot find module" error
Make sure you're running commands from the project root: `/Users/laiyama/Project/SMGE`

### CLI login fails
Use Method 1 (Dashboard) instead - no login required!

### Types file is empty
- Verify all migrations were applied successfully in Supabase dashboard
- Check: https://app.supabase.com/project/orharllggjmfsalcshpu/editor

### Still getting build errors after generating types
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

---

## Quick Commands Reference

```bash
# Create directory (already done)
mkdir -p lib/db

# Generate types (requires CLI login)
supabase gen types typescript --project-id orharllggjmfsalcshpu > lib/db/types.ts

# Verify build
npm run build

# Start dev server
npm run dev
```

---

## Next Steps After Types Are Generated

1. ✅ Build succeeds: `npm run build`
2. ✅ TypeScript errors: 0
3. ✅ Full type safety for all database operations
4. ✅ Ready to start developing features!

---

**Status:** Waiting for types generation
**Action Required:** Follow Method 1 (Dashboard) or Method 2 (CLI) above
**Project:** SMGE - Social Media Growth Engine
**Database:** Supabase Project `orharllggjmfsalcshpu`
