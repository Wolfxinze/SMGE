# Fix: React Rendering Errors (Issue #12)

## Problem Summary

Build process was failing with React rendering errors during static page generation:

```bash
TypeError: Cannot read properties of null (reading 'useContext')
Each child in a list should have a unique "key" prop
```

## Root Cause

**NOT a Next.js 16/React 19 framework bug** as initially suspected.

The issue was caused by **manually setting NODE_ENV in the shell environment**, which conflicts with Next.js's internal build process. Next.js expects to control NODE_ENV automatically:
- `next dev` → sets `NODE_ENV=development`
- `next build` → sets `NODE_ENV=production`

When NODE_ENV is manually set to `development` and then `npm run build` is executed, Next.js internals encounter a mismatch between the environment variable and the build mode, causing React context initialization failures.

## Investigation Process

Deep debugging using systematic analysis revealed:

1. ✅ TypeScript compilation passes successfully
2. ❌ Build fails only during static page generation
3. ⚠️ Warning: "non-standard NODE_ENV value" in build output
4. ✅ Build succeeds when NODE_ENV is unset

## Solution

### Immediate Fix

**Unset NODE_ENV before building:**

```bash
unset NODE_ENV && npm run build
```

### Permanent Fix

**1. Remove NODE_ENV from .env files:**

The `.env.local.example` file has been updated with clear warnings:

```bash
# IMPORTANT: Do NOT set NODE_ENV manually!
# Next.js automatically sets NODE_ENV based on the command:
#   - 'next dev' sets NODE_ENV=development
#   - 'next build' sets NODE_ENV=production
# Setting it manually causes build failures and unexpected behavior
# NODE_ENV=development  # ❌ NEVER DO THIS
```

**2. Check your shell configuration:**

Ensure NODE_ENV is NOT set in:
- `~/.zshrc`
- `~/.bashrc`
- `~/.bash_profile`
- `~/.zprofile`

**3. Verify clean environment:**

```bash
# Check if NODE_ENV is set
echo $NODE_ENV

# If it returns anything, unset it
unset NODE_ENV

# Add to your shell config if needed
# echo "unset NODE_ENV" >> ~/.zshrc
```

## Verification

After fixing, the build should complete successfully:

```bash
npm run build

# Expected output:
✓ Compiled successfully in 11.0s
Running TypeScript ...
✓ Generating static pages (39/39)
```

## Build Results (After Fix)

- ✅ TypeScript compilation: SUCCESS
- ✅ Static page generation: SUCCESS (39/39 pages)
- ✅ All routes properly generated
- ✅ No React warnings or errors

## Key Takeaways

1. **Never manually set NODE_ENV** - Let Next.js manage it
2. **Check environment variables** when debugging build issues
3. **Warning messages matter** - The "non-standard NODE_ENV" warning was the key clue
4. **Don't assume framework bugs** - User configuration issues are more common

## Prevention

To prevent this issue from recurring:

1. ✅ Updated `.env.local.example` with explicit warnings
2. ✅ Documented the fix in troubleshooting guide
3. ✅ Added to project onboarding checklist
4. ⚠️ Consider adding a pre-build script to check for NODE_ENV

## Related Issues

- GitHub Issue #12: Fix React rendering errors
- Next.js documentation: [Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- Next.js warning: [non-standard-node-env](https://nextjs.org/docs/messages/non-standard-node-env)

## Credits

Fix identified through systematic debugging using the `code-analyzer-debugger` agent, which:
1. Formed multiple hypotheses about the root cause
2. Gathered evidence from build logs and configuration files
3. Tested each hypothesis systematically
4. Isolated the NODE_ENV variable as the culprit
5. Verified the fix with a clean build

---

**Status:** ✅ RESOLVED
**Date:** 2025-11-27
**Build Version:** Next.js 16.0.5, React 19.2.0
