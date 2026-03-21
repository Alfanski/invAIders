---
name: eclipse-implement
description: >-
  Implement features or fixes following project conventions. Loads repo-specific
  knowledge from AGENTS.md and .cursor/rules/ to apply project-specific patterns.
  Extracts requirements into a trackable checklist, analyzes blast radius, plans
  first, implements with tests, verifies every requirement, updates documentation,
  and prepares a PR via GitHub CLI. Use when implementing a feature, fixing a bug,
  or when the user says "implement", "build", "add feature", or "implement issue #N".
---

# Eclipse Implement

End-to-end workflow for implementing requirements. Every requirement MUST be resolved.

---

## Phase 0: Load Project Context

Before implementing, gather repo-specific knowledge:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- project architecture, commands, layer rules
2. **`tasks/lessons.md`** -- recent corrections (avoid repeating mistakes)
3. **Coding rules** for the file types you'll touch:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped)
   - Claude Code: subdirectory `CLAUDE.md` files (proximity-scoped)
4. **Subdirectory docs** -- module-level `AGENTS.md` or `CLAUDE.md` for areas you'll change

These files define how code should be written in this specific repository.

**Context budget**: Keep Phase 0 reads under ~3,000 tokens total. Only read
rules/subdirectory docs relevant to the files you'll change.

---

## Phase 1: Requirement Extraction

### 1.1 Fetch the Issue (if applicable)

```bash
gh issue view <number> --json title,body,labels,assignees,milestone
```

### 1.2 Extract Requirements into Checklist

Parse the issue/request and create an explicit checklist:

```markdown
## Requirements Checklist

### Explicit Requirements
- [ ] R1: <requirement>
- [ ] R2: <requirement>

### Acceptance Criteria
- [ ] AC1: <criterion>
- [ ] AC2: <criterion>

### Implicit Requirements (inferred)
- [ ] IR1: Error handling for new code paths
- [ ] IR2: Logging for observability
- [ ] IR3: Config for new settings (if applicable)
- [ ] IR4: Test coverage for all new code
```

**Present this checklist for confirmation before proceeding.** The user may
add missing requirements or clarify ambiguities.

---

## Phase 2: Architecture & Blast Radius Analysis

### 2.1 Classify the Change

Read `CLAUDE.md` and `AGENTS.md` for project architecture, then classify:

| Category | Indicators |
|----------|-----------|
| Feature | New endpoint, new component, new service |
| Fix | Bug report, incorrect behavior |
| Refactor | No behavior change, structural improvement |
| Infra | CI, config, dependency, tooling |

### 2.2 Blast Radius

For each file that will change, check:

1. **Integration impact** -- downstream consumers, API contracts
2. **Config impact** -- new env vars, settings
3. **State/data impact** -- migrations, schemas
4. **Cross-service impact** -- sibling repos, shared contracts

### 2.3 Present the Plan

```markdown
## Implementation Plan for #N

### Files to Create
- path -- purpose

### Files to Modify
- path -- what changes and why

### Files to Read (context only)
- path -- why needed

### Requirement Coverage
- R1 --> file.py (function/method)
- AC1 --> test_file.py (test name)
```

**Wait for user approval before writing code.**

---

## Phase 3: Branch Setup

```bash
git checkout main && git pull origin main
git checkout -b <type>/<issue>-<description>
```

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<issue>-<desc>` | `feat/42-add-search-endpoint` |
| Bug fix | `fix/<issue>-<desc>` | `fix/15-null-pointer-on-empty` |
| Refactor | `refactor/<issue>-<desc>` | `refactor/30-extract-service` |

---

## Phase 4: Implementation

### 4.1 Standards

Follow all patterns from coding rules and project docs (`AGENTS.md`, `CLAUDE.md`). Universal rules:

- Type hints on all public functions
- Guard clauses (early returns) to flatten nesting
- Exception chaining: `raise ServiceError("msg") from e`
- No bare `except:` or silent `except: pass`
- Structured logging (never f-strings in log calls)
- No hardcoded secrets or credentials

### 4.2 For Each File

1. Read the full file first to understand context
2. Read the subdirectory docs (`AGENTS.md` or `CLAUDE.md`) for module patterns
3. Make changes following project conventions
4. Keep functions focused and appropriately sized

---

## Phase 5: Testing

1. Write tests for all new/changed code
2. Follow project test naming conventions (check `AGENTS.md`)
3. Run tests: use the command from `CLAUDE.md`
4. Run lint: use the lint command from `CLAUDE.md`
5. Fix all failures before proceeding

---

## Phase 6: Documentation Update (MANDATORY)

Every implementation must update documentation. This is not optional.

- [ ] Did I change any commands? --> Update `CLAUDE.md`
- [ ] Did I change architecture? --> Update `CLAUDE.md` + relevant `AGENTS.md`
- [ ] Did I add new patterns? --> Update coding rules (`.cursor/rules/` or subdirectory `CLAUDE.md`)
- [ ] Did I add new config? --> Update `.env.example` + `CLAUDE.md`
- [ ] Did I change integration points? --> Update data contracts
- [ ] Did I learn something? --> Add to `tasks/lessons.md`

---

## Phase 7: Requirement Verification (MANDATORY)

Go back to the Phase 1 checklist and verify EVERY item:

```markdown
## Verification -- #N

### Explicit Requirements
- [x] R1: <req> --> Implemented in src/path.py
- [x] R2: <req> --> Implemented in src/other.py

### Acceptance Criteria
- [x] AC1: <criterion> --> Verified by test_scenario_success

### UNRESOLVED (if any)
- [ ] <req> -- Reason: <why not resolved>
```

**If ANY requirement is unresolved**, implement it or discuss with the user.
Never silently skip requirements.

---

## Phase 8: Commit & PR

### 8.1 Commit

```bash
git add -A
git commit -m "feat(scope): short description (#N)

- Implemented <requirement summary>
- Added tests for <what>
- Updated <docs if any>

Closes #N"
```

### 8.2 Push and Create PR

Use the template from `assets/pr-template.md` for the PR body. Fill in the
requirement coverage table from Phase 7 verification.

```bash
git push -u origin HEAD
gh pr create --title "feat(scope): description (#N)" --body-file assets/pr-template.md
```

## Bundled Resources

- **`assets/pr-template.md`** -- PR body template with requirement coverage table.
  Copy and fill in before creating the PR.
