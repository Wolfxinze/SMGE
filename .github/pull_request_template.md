# Pull Request

## Related Issue

Closes #

## Code Review Status

**MANDATORY: All PRs must be code reviewed before merge.**

- [ ] Code review requested via `/superpowers:requesting-code-review`
- [ ] All blockers (🔴 Critical) fixed
- [ ] All important issues (🟡 Important) addressed or documented
- [ ] Received **"✅ APPROVED"** status from code reviewer

**Code Review Evidence:**
<!-- Paste link to code review summary or key findings here -->

---

## Summary

<!-- Brief description of what this PR does -->

## Changes Made

<!-- List the main changes in bullet points -->
-
-
-

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Security fix

---

## Testing

### Manual Testing Performed

- [ ] Tested locally in development environment
- [ ] Tested authentication flows (if applicable)
- [ ] Tested with different user roles (if applicable)
- [ ] Tested edge cases and error conditions
- [ ] Verified no regressions in related features

### Test Results

<!-- Describe what you tested and the results -->

### Screenshots/Videos

<!-- If applicable, add screenshots or videos demonstrating the changes -->

---

## Database Changes

- [ ] No database changes
- [ ] Migration(s) included:
  - [ ] Migration is idempotent (safe to run multiple times)
  - [ ] RLS policies tested
  - [ ] No SECURITY DEFINER vulnerabilities (NULL checks, search_path set)
  - [ ] Backward compatible

---

## Security Considerations

- [ ] No security implications
- [ ] Security review completed
- [ ] Input validation added
- [ ] Authentication/authorization verified
- [ ] No sensitive data exposed in logs/errors
- [ ] OWASP Top 10 vulnerabilities checked

**Security Notes:**
<!-- If there are security implications, describe them and how they're addressed -->

---

## Performance Impact

- [ ] No performance impact
- [ ] Performance tested
- [ ] Database queries optimized
- [ ] API endpoints tested under load (if applicable)

---

## Backward Compatibility

- [ ] Fully backward compatible
- [ ] Breaking changes documented below

**Breaking Changes:**
<!-- List any breaking changes and migration path for users -->

---

## Deployment Notes

<!-- Any special deployment steps or considerations -->

- [ ] No special deployment steps required
- [ ] Environment variables updated in `.env.example`
- [ ] Dependencies added to `package.json`
- [ ] Database migrations need to run
- [ ] Cache needs to be cleared
- [ ] Other:

---

## Checklist

- [ ] Code follows the project style guidelines
- [ ] Self-review of code completed
- [ ] Comments added in hard-to-understand areas
- [ ] No console.log or debug code left in
- [ ] Documentation updated (if applicable)
- [ ] No new warnings or errors introduced
- [ ] Commit messages are clear and descriptive

---

## Additional Context

<!-- Any other information that reviewers should know -->

---

## Post-Merge Tasks

<!-- Tasks that need to be done after this PR is merged -->

- [ ] Monitor error logs for 24 hours
- [ ] Update related documentation
- [ ] Create follow-up issues for technical debt
- [ ] Other:

---

**Generated with [Claude Code](https://claude.com/claude-code)**
