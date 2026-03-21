---
name: eclipse-refactor
description: >-
  Safe, incremental refactoring with blast radius analysis and verification at
  every step. Loads repo-specific knowledge from AGENTS.md and coding rules to
  preserve project conventions. Supports extract, rename, move, simplify, and
  restructure operations. Use when refactoring code, restructuring modules,
  reducing complexity, or when the user says "refactor", "clean up", "simplify",
  "extract", or "restructure".
---

# Eclipse Refactor

Safe, incremental refactoring. Behavior must not change unless explicitly intended.

## Operating Principles

1. **Behavior preservation** -- the system does the same thing after refactoring
2. **Incremental steps** -- one refactoring operation per commit (reviewable diffs)
3. **Test at every step** -- run tests after each operation, not just at the end
4. **Blast radius awareness** -- know what depends on what you're changing
5. **Convention alignment** -- refactored code follows project patterns, not personal style

---

## Phase 0: Load Project Context

Before refactoring, gather repo-specific knowledge:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- architecture, layer rules, module boundaries
2. **`tasks/lessons.md`** -- patterns and anti-patterns specific to this repo
3. **Coding rules** for the affected file types:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped)
   - Claude Code: subdirectory `CLAUDE.md` files (proximity-scoped)
4. **Subdirectory docs** -- `AGENTS.md` or `CLAUDE.md` for affected modules

**Context budget**: Read root docs fully. Only read rules for affected file types.

---

## Phase 1: Assess

### 1.1 Understand the Goal

Classify the refactoring. For detailed steps and risks per type, read
`references/refactor-types.md`.

| Type | Description | Risk |
|------|------------|------|
| **Extract** | Pull function/class/module out | Low |
| **Rename** | Change name across codebase | Low-Medium |
| **Move** | Relocate to different module | Medium |
| **Simplify** | Reduce complexity, flatten nesting | Low |
| **Restructure** | Change module boundaries or architecture | High |
| **Dedup** | Remove duplication | Medium |

### 1.2 Blast Radius Analysis

```bash
# Find all references to the target
grep -rn "[function/class/module name]" --include="*.py" --include="*.ts"

# Check imports
grep -rn "from [module]" --include="*.py"
grep -rn "import.*[name]" --include="*.ts"

# Check tests that cover this code
grep -rn "[function/class name]" tests/
```

Document the blast radius:

```markdown
## Blast Radius

**Target**: [What is being refactored]
**Direct dependents**: [Files that import/call the target]
**Indirect dependents**: [Files that depend on direct dependents]
**Test coverage**: [Tests that exercise the target]
**External consumers**: [APIs, other services, public interfaces]
```

### 1.3 Verify Baseline

Before changing anything, ensure all tests pass:

```bash
[test command from CLAUDE.md]
[lint command from CLAUDE.md]
```

Record the baseline:

```markdown
## Baseline
- Tests: [N passing, M failing]
- Lint: [clean / N warnings]
```

**If tests are failing before the refactor**, stop and discuss with the user.
Do not refactor on a broken baseline.

---

## Phase 2: Plan

Present the plan for approval:

```markdown
## Refactoring Plan

### Goal
[What and why -- 1-2 sentences]

### Steps (each is a separate commit)
1. [Operation]: [What] in [file] -- [why]
2. [Operation]: [What] in [file] -- [why]
3. [Operation]: Update imports/references
4. [Operation]: Update tests
5. [Operation]: Update documentation

### What Will NOT Change
- [Explicitly list preserved behaviors]

### Risk Mitigation
- Incremental commits (easy to revert any step)
- Tests run after every step
- [Other safeguards]
```

**Wait for user approval before proceeding.**

---

## Phase 3: Execute

For each step in the plan:

### 3.1 Make One Refactoring Operation

- Apply exactly one operation (extract, rename, move, etc.)
- Follow all project conventions from coding rules
- Preserve existing behavior -- no "while I'm here" improvements

### 3.2 Update References

- Update all imports and call sites found in blast radius analysis
- Update type annotations if signatures changed
- Update any configuration that references the old location/name

### 3.3 Run Tests

```bash
# After EVERY operation
[test command]
[lint command]
```

If tests fail:
1. Determine if the failure is from the refactoring or pre-existing
2. Fix refactoring-caused failures immediately
3. Do NOT proceed to the next step until tests pass

### 3.4 Commit

```bash
git add -A
git commit -m "refactor(scope): [operation] [what]"
```

One commit per operation for clean, reviewable history.

---

## Phase 4: Verify

### 4.1 Final Test Run

```bash
# Full test suite
[test command]
[lint command]
```

### 4.2 Compare to Baseline

```markdown
## Verification

### Test Results
- Before: [N passing, M failing]
- After: [N passing, M failing]
- Delta: [no change / explain differences]

### Behavior Preserved
- [ ] All existing tests pass
- [ ] No new warnings introduced
- [ ] Public API unchanged (or changes documented)
- [ ] Performance characteristics preserved
```

### 4.3 Review the Full Diff

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

Verify the diff looks clean -- no accidental changes, no debug code left in.

---

## Phase 5: Documentation

- [ ] If module boundaries changed --> update `AGENTS.md` / subdirectory docs
- [ ] If coding patterns changed --> update coding rules
- [ ] If the refactoring revealed a gotcha --> add to `tasks/lessons.md`
- [ ] If commands changed --> update `CLAUDE.md`

---

## Bundled Resources

- **`references/refactor-types.md`** -- Detailed steps, risks, and patterns for
  each refactoring type (extract, rename, move, simplify, dedup, restructure).
  Read when planning to select the right approach.

## Constraints

- Never combine refactoring with behavior changes in the same commit
- Never refactor code you don't have tests for (write tests first, then refactor)
- Never "improve" code style that doesn't match the project's conventions
- If the refactoring grows larger than planned, stop and re-plan
- Preserve git blame usefulness -- don't reformat entire files
