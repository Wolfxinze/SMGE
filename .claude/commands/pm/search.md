---
allowed-tools: Bash
---

# PM Search

Search across all PRDs, epics, and tasks for a specific term.

## Usage
```
/pm:search <search-term>
```

Searches in:
- PRD titles and content
- Epic descriptions and tasks
- Task names and acceptance criteria

Returns matching results with file paths.

```bash
bash .claude/scripts/pm/search.sh $ARGUMENTS
```
