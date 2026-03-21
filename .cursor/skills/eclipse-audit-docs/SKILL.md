---
name: eclipse-audit-docs
description: >-
  Audit agent configuration files (CLAUDE.md, AGENTS.md, .cursor/rules/, skills)
  against the actual codebase to find stale, incorrect, or missing documentation.
  Reports gaps with specific fix suggestions. Use when auditing documentation,
  checking for stale docs, or when the user says "audit docs", "check agent
  files", or "are the docs up to date".
---

# Eclipse Documentation Audit

Verify that agent configuration files accurately describe the codebase.

---

## Phase 0: Load Project Context

Read all agent files to understand the documented state:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- root project documentation
2. **Coding rules** -- all rule files:
   - Cursor: `.cursor/rules/*.mdc`
   - Claude Code: subdirectory `CLAUDE.md` files
3. **Skills** -- all deployed skills:
   - Cursor: `.cursor/skills/*/SKILL.md`
   - Claude Code: `.claude/skills/*/SKILL.md`
4. **Subdirectory `AGENTS.md`** and **`CLAUDE.md`** files
5. **`tasks/lessons.md`** and **`tasks/lessons-pr.md`** -- knowledge files

---

## Quick Audit

Run the automated audit script first to catch structural issues:

```bash
scripts/audit.sh --help
scripts/audit.sh --quick    # File existence, budgets, skill counts
scripts/audit.sh --full     # Also checks file references
```

Then manually review the items the script can't automate.

## Audit Checklist

### 1. Commands Verification

For each command listed in CLAUDE.md and AGENTS.md, verify it works:

```bash
[command from docs]
```

Report: command works / fails / partially works / has changed

### 2. Directory Structure Verification

Compare the documented tree against reality. Report directories added, removed,
or renamed since docs were written.

### 3. File Reference Verification

The `--full` mode of `scripts/audit.sh` checks file references automatically.
For any flagged as missing, verify manually and update docs.

### 4. Pattern Accuracy

For each coding pattern or anti-pattern documented:

- Search the codebase for examples
- Verify the pattern is actually used (not aspirational)
- Verify anti-patterns are actually avoided

### 5. Integration Points

For each integration documented (webhooks, APIs, queues):

- Verify the endpoint/URL is still correct
- Verify the payload shape matches
- Verify auth requirements are current

### 6. Line Budget Check

| File | Lines | Budget | Status |
|------|-------|--------|--------|
| CLAUDE.md | [actual] | <=100 | [over/under] |
| AGENTS.md | [actual] | <=120 | [over/under] |
| Coding rules (`.cursor/rules/*.mdc` / subdirectory `CLAUDE.md`) | [actual each] | <=150 | [over/under] |
| Subdirectory AGENTS.md | [actual each] | <=100 | [over/under] |

### 7. Cross-Reference Check

- Every pointer in root files resolves to an actual file
- No orphaned subdirectory docs (module still exists)
- No orphaned coding rules (file patterns still match real files)

### 8. Skills Deployed Check

Verify all 10 framework skills are present and symlinked:

```bash
ls .cursor/skills/eclipse-*/SKILL.md
ls -la .claude/skills/eclipse-*
```

### 9. Hooks Configuration Check

```bash
cat .claude/settings.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Hooks:', list(d.get('hooks',{}).keys()))"
cat .cursor/hooks.json 2>/dev/null
ls -la .cursor/hooks/*.sh 2>/dev/null
```

---

## Output Format

Use the template from `assets/audit-report.md` to structure the output.
Includes sections for summary, critical/important/minor issues, and verified
sections.

---

## Bundled Resources

- **`scripts/audit.sh`** -- Automated audit checks. Run with `--help` to see
  options. `--quick` checks structure, `--full` also verifies file references.
- **`assets/audit-report.md`** -- Report template. Copy and fill in with findings.

## After the Audit

1. Fix critical issues immediately
2. Create tasks for important issues
3. Log minor issues in `tasks/lessons.md` for later
4. If many issues found, consider re-running `setup.md` to refresh skills and hooks
