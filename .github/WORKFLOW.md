# SMGE Development Workflow

**Last Updated:** 2025-11-28
**Status:** MANDATORY for all contributions

---

## The Iron Law

> **No code reaches main without code review approval. Period.**

This is non-negotiable. If you see a merge attempt without prior code review approval, **STOP THE MERGE** immediately.

---

## Quick Start

```bash
# 1. Pick next task
/pm:next

# 2. Start work (creates feature branch automatically)
/pm:issue-start <issue-number>

# 3. Implement changes on feature branch
git add .
git commit -m "Implement feature X"

# 4. Request code review (MANDATORY before merge)
/superpowers:requesting-code-review

# 5. Fix ALL blockers from review
# ... make fixes ...
git add .
git commit -m "Fix code review issues"

# 6. Get explicit "✅ APPROVED" status from reviewer

# 7. Create pull request
gh pr create --title "..." --body "..."

# 8. Merge PR (auto-closes issue)
gh pr merge --squash
```

---

## Detailed Workflow

### Step 1: Pick a Task

Use the CCPM (Claude Code Project Management) workflow:

```bash
# See overall project status
/pm:status

# Get next priority task
/pm:next

# View specific epic
/pm:epic-show smge
```

**Output:**
```
Next task: #16 [P0 SECURITY] Privilege Escalation in Migration 00014
Epic: SMGE
Priority: P0 - BLOCKER
Effort: 2-3 hours
```

### Step 2: Start Work on Issue

```bash
# Creates feature branch automatically
/pm:issue-start 16
```

**What this does:**
1. Creates branch: `feature/016-privilege-escalation-migration-00014`
2. Checks out the new branch
3. Syncs issue status to "in progress" on GitHub
4. Sets up tracking for the issue

**Manual alternative (if PM commands not available):**
```bash
git checkout -b feature/016-privilege-escalation-migration-00014
```

### Step 3: Implement Changes

Work normally on your feature branch:

```bash
# Make changes
vim supabase/migrations/00014_fix_signup_error_handling.sql

# Test locally
npm run dev

# Commit frequently
git add .
git commit -m "Remove blanket RLS bypass policies"

git add .
git commit -m "Add SECURITY DEFINER function for profile creation"
```

**Best Practices:**
- Commit frequently with descriptive messages
- Test thoroughly before requesting review
- Keep changes focused on the issue
- Don't mix unrelated changes

### Step 4: Request Code Review (MANDATORY)

**Before creating any PR, you MUST request code review:**

```bash
# Use superpowers skill
/superpowers:requesting-code-review
```

**The code reviewer will:**
1. Analyze all changes in your feature branch
2. Check for security vulnerabilities
3. Verify code quality and patterns
4. Test for edge cases
5. Provide detailed feedback with severity levels:
   - 🔴 **Critical** - Must fix before merge (blockers)
   - 🟡 **Important** - Should fix before merge
   - 🟢 **Minor** - Nice to have, can fix later

**Example Output:**
```
Code Review Complete ✓

Taste Score: GOOD

Critical Issues (2):
🔴 NULL check missing in function parameter
🔴 Missing SET search_path in SECURITY DEFINER function

Important Issues (1):
🟡 Consider adding index on user_id column

Minor Issues (1):
🟢 Variable naming could be more descriptive

Assessment: Fix critical issues before merge
```

### Step 5: Fix ALL Blockers

You **MUST** fix all 🔴 Critical issues before proceeding:

```bash
# Make fixes
vim supabase/migrations/00014_fix_signup_error_handling.sql

# Commit fixes
git add .
git commit -m "Add NULL checks and SET search_path to SECURITY DEFINER"

# Re-request review if major changes
/superpowers:requesting-code-review
```

**Continue until you get:**
```
✅ APPROVED - Ready to merge
```

### Step 6: Create Pull Request

Only after code review approval:

```bash
# Create PR using template
gh pr create --title "Fix: Privilege Escalation in Migration 00014" \
  --body "$(cat .github/pull_request_template.md)"
```

**Fill in the template:**
- Link to issue: `Closes #16`
- Code review status: ✅ APPROVED
- Summary of changes
- Testing performed

### Step 7: Merge to Main

After PR is approved:

```bash
# Squash merge (keeps history clean)
gh pr merge --squash

# Or via GitHub UI
# Click "Squash and merge" button
```

**What happens:**
- PR is merged to main
- Issue is auto-closed (via "Closes #16" in PR description)
- Feature branch can be deleted
- GitHub status updated

### Step 8: Sync Status (Optional)

If using CCPM:

```bash
# Update epic progress
/pm:epic-status smge

# Close issue manually if not auto-closed
/pm:issue-close 16
```

---

## Workflow Violations

### ❌ NEVER Do This

**Direct commits to main:**
```bash
# ❌ WRONG
git checkout main
git add .
git commit -m "Quick fix"
git push origin main
```

**Skipping code review:**
```bash
# ❌ WRONG
git checkout -b feature/my-feature
# ... make changes ...
gh pr create  # Without /superpowers:requesting-code-review
gh pr merge
```

**Merging with unresolved blockers:**
```bash
# ❌ WRONG
# Code review shows: 🔴 Critical SQL injection vulnerability
# You: "I'll fix it later" → merge anyway
```

### ✅ Always Do This

**Use feature branches:**
```bash
# ✅ CORRECT
/pm:issue-start 16
# ... make changes ...
/superpowers:requesting-code-review
# ... fix blockers ...
gh pr create
gh pr merge
```

**Request review before PR:**
```bash
# ✅ CORRECT
/superpowers:requesting-code-review
# Wait for ✅ APPROVED
gh pr create
```

**Fix all blockers:**
```bash
# ✅ CORRECT
# Code review shows: 🔴 Critical issue
# Fix the issue
# Re-request review if needed
# Get ✅ APPROVED
# Then merge
```

---

## Special Cases

### Hotfix for Production

Even hotfixes follow the workflow (faster, but still reviewed):

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-security-fix

# 2. Make minimal fix
vim app/api/auth/route.ts

# 3. Request expedited review
/superpowers:requesting-code-review

# 4. Fix blockers immediately
# ... fixes ...

# 5. Create PR with [HOTFIX] tag
gh pr create --title "[HOTFIX] Fix critical auth bypass"

# 6. Get approval and merge
gh pr merge --squash
```

### Multiple Related Issues

If working on multiple related issues:

```bash
# Start with first issue
/pm:issue-start 16

# After completing and reviewing issue 16:
/superpowers:requesting-code-review
# ... get approved ...

# Continue on same branch for related issue
/pm:issue-start 17  # Links to same branch

# After completing issue 17:
/superpowers:requesting-code-review
# ... get approved ...

# Create single PR closing both
gh pr create --body "Closes #16, Closes #17"
```

### Large Features (Epic-level)

For large features spanning multiple issues:

```bash
# Use subagent-driven development
/superpowers:write-plan  # Creates implementation plan

# Execute plan in batches
/superpowers:execute-plan

# Review after each batch
/superpowers:requesting-code-review

# Merge when all tasks complete
```

---

## Tools Reference

### CCPM Commands

| Command | Purpose |
|---------|---------|
| `/pm:status` | Overall project dashboard |
| `/pm:next` | Get next priority task |
| `/pm:issue-start <#>` | Start work (creates branch) |
| `/pm:issue-sync <#>` | Push progress updates |
| `/pm:issue-close <#>` | Mark complete (after merge) |
| `/pm:epic-show <name>` | View epic progress |

### Superpowers Skills

| Skill | Purpose |
|-------|---------|
| `/superpowers:requesting-code-review` | MANDATORY before PR |
| `/superpowers:write-plan` | Plan large features |
| `/superpowers:execute-plan` | Execute in batches |
| `/superpowers:brainstorm` | Design refinement |

### GitHub CLI

| Command | Purpose |
|---------|---------|
| `gh pr create` | Create pull request |
| `gh pr merge --squash` | Merge with squash |
| `gh pr review` | Review PR |
| `gh issue create` | Create new issue |
| `gh issue close <#>` | Close issue |

---

## Enforcement

### Branch Protection Rules

Main branch has these protections enabled:

- ✅ Require pull request before merging
- ✅ Require approvals (minimum: 1)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators (even you must follow workflow)

**You cannot push directly to main.** GitHub will reject it.

### Automated Checks

Pull requests must pass:

- ✅ TypeScript build
- ✅ Linting (ESLint)
- ✅ Tests (if applicable)
- ✅ Code review approval

### Review Requirements

Every PR requires:

1. **Code review requested** via `/superpowers:requesting-code-review`
2. **All 🔴 Critical issues fixed**
3. **Explicit "✅ APPROVED" status**
4. **PR template filled out** (links issue, documents changes)

---

## Examples

### Example 1: Simple Bug Fix

```bash
# 1. Pick task
/pm:next
# → #18 [P0 SECURITY] Missing Authentication Guards

# 2. Start work
/pm:issue-start 18
# → Creates feature/018-missing-authentication-guards

# 3. Fix the bug
vim app/(dashboard)/posts/page.tsx
# Add: const { data: { user } } = await supabase.auth.getUser()
# Add: if (!user) router.push('/auth/signin')

git add .
git commit -m "Add auth guard to posts page"

# 4. Request review
/superpowers:requesting-code-review
# → ✅ APPROVED - Ready to merge

# 5. Create PR
gh pr create --title "Fix: Add authentication guards to posts pages" \
  --body "Closes #18

## Changes
- Added auth checks before database queries
- Redirect to login if not authenticated

## Code Review
✅ APPROVED via /superpowers:requesting-code-review

## Testing
- Manual test: Access /posts while logged out → redirects to /auth/signin
- Manual test: Access /posts while logged in → loads normally
"

# 6. Merge
gh pr merge --squash
```

### Example 2: Complex Feature

```bash
# 1. Create implementation plan
/superpowers:write-plan
# Describe feature, get detailed plan

# 2. Start first task
/pm:issue-start 21

# 3. Implement task 1
# ... code ...
git commit -m "Implement task 1: Database schema"

# 4. Review task 1
/superpowers:requesting-code-review
# → Fix blockers, get approved

# 5. Implement task 2
# ... code ...
git commit -m "Implement task 2: API endpoints"

# 6. Review task 2
/superpowers:requesting-code-review
# → Fix blockers, get approved

# 7. Create PR after all tasks
gh pr create
gh pr merge --squash
```

---

## Questions?

- **Workflow not working?** Check branch protection rules in GitHub settings
- **Code review failing?** Read the detailed feedback in `CODE_REVIEW_*.md` files
- **PM commands not found?** Ensure CCPM setup: `/pm:init`
- **Need help?** Ask in project discussions or create an issue

---

## History

| Date | Change |
|------|--------|
| 2025-11-28 | Created mandatory workflow after detecting systematic bypass of review process |
| 2025-11-28 | Added branch protection enforcement |
| 2025-11-28 | Documented code review requirements |

---

**Remember: Code review is not optional. It's the last line of defense before production.**
