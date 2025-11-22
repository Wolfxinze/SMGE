---
allowed-tools: Bash
---

# PM Validate

Validate CCPM workspace structure and data integrity.

Checks for:
- Valid frontmatter in all PRDs, epics, and tasks
- Correct file structure
- Consistent task dependencies
- Missing or broken references

```bash
bash .claude/scripts/pm/validate.sh
```
