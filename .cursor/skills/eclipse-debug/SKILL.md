---
name: eclipse-debug
description: >-
  Systematic debugging workflow: reproduce the bug, gather evidence, bisect to
  root cause, fix with minimal blast radius, verify the fix, and add a
  regression test. Loads repo-specific knowledge from AGENTS.md and
  tasks/lessons.md to avoid known gotchas. Use when debugging a bug, investigating
  unexpected behavior, or when the user says "debug", "investigate", "why is this
  failing", or "fix this error".
---

# Eclipse Debug

Systematic, evidence-driven debugging. Never guess -- prove.

## Operating Principles

1. **Reproduce first** -- if you can't trigger the bug, you can't prove it's fixed
2. **Gather evidence** -- logs, stack traces, state snapshots before theorizing
3. **Bisect, don't hunt** -- narrow the search space systematically
4. **Minimal fix** -- change as little as possible to fix the root cause
5. **Prove the fix** -- the same reproduction steps must now pass
6. **Prevent recurrence** -- add a regression test and update docs

---

## Phase 0: Load Project Context

Before debugging, gather repo-specific knowledge:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- commands, architecture, known gotchas
2. **`tasks/lessons.md`** -- previous corrections (the bug may relate to a known gotcha)
3. **Coding rules** for the affected file types:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped)
   - Claude Code: subdirectory `CLAUDE.md` files (proximity-scoped)

**Context budget**: Keep Phase 0 reads under ~2,000 tokens. Focus on gotchas
and anti-patterns sections -- those are the highest-signal content for debugging.

---

## Phase 1: Reproduce

### 1.1 Capture the Bug Report

Document what you know:

```markdown
## Bug Report

**Symptom**: [What's happening]
**Expected**: [What should happen]
**Environment**: [OS, runtime version, config]
**Trigger**: [Steps to reproduce, or "unknown"]
**Frequency**: [Always / intermittent / one-time]
```

### 1.2 Create a Reproduction

```bash
# Run the failing test or command from CLAUDE.md/AGENTS.md
[test command] [specific test or scenario]
```

If no existing test covers it, write a minimal reproduction:

```bash
# Minimal script or curl command that triggers the bug
[reproduction command]
```

**If you cannot reproduce**: Gather more evidence (Phase 2) before proceeding.
Ask the user for additional context. Do NOT guess at a fix.

---

## Phase 2: Gather Evidence

### 2.1 Error Context

```bash
# Stack trace from logs or stderr
[command that produces the error]

# Relevant log entries (check CLAUDE.md for log locations)
[log command] | grep -i error | tail -50
```

### 2.2 State Inspection

Check the state at the point of failure:

- **Data**: Query the relevant data (DB, API, file) to see actual vs. expected
- **Config**: Verify environment variables, settings, feature flags
- **Dependencies**: Check versions of relevant packages

### 2.3 Recent Changes

```bash
# What changed recently in the affected area?
git log --oneline -20 -- [affected-path]
git diff HEAD~5 -- [affected-path]
```

---

## Phase 3: Bisect to Root Cause

### 3.1 Form Hypotheses

Based on evidence, list possible causes ranked by likelihood:

```markdown
## Hypotheses (ranked)

1. [Most likely] -- Evidence: [what points here]
2. [Possible] -- Evidence: [what points here]
3. [Less likely] -- Evidence: [what points here]
```

### 3.2 Test Hypotheses

For each hypothesis, starting with most likely:

1. **Predict**: "If this hypothesis is correct, then [observable consequence]"
2. **Test**: Run the smallest possible check to confirm or refute
3. **Record**: Note the result and move to the next hypothesis if refuted

```bash
# Example: test hypothesis by adding a targeted assertion or log
[diagnostic command]
```

### 3.3 Git Bisect (for regressions)

If the bug worked before and is now broken, use the bundled bisect helper:

```bash
scripts/bisect.sh --help
scripts/bisect.sh --good [last-known-good-commit] --bad HEAD --test "[test-command]"
```

Run with `--help` first to see options. The script handles bisect start/reset
automatically and reports the first bad commit.

### 3.4 Confirm Root Cause

Before fixing, state the root cause explicitly:

```markdown
## Root Cause

**What**: [Precise description of the bug]
**Where**: [File:line or function]
**Why**: [Why the code is wrong -- logic error, missing guard, stale state, etc.]
**When introduced**: [Commit or date if known]
```

**Present the root cause analysis to the user before proceeding to fix.**

---

## Phase 4: Fix

### 4.1 Plan the Fix

```markdown
## Fix Plan

**Approach**: [What will change and why]
**Files**: [List of files to modify]
**Blast radius**: [What else could be affected]
**Risk**: [Low/medium/high -- what could go wrong]
```

### 4.2 Implement

- Change as little as possible -- fix the root cause, not symptoms
- Follow all project coding standards from `AGENTS.md` and coding rules
- Add comments only if the fix is non-obvious (explain the "why")

### 4.3 Run Existing Tests

```bash
# Use the test command from CLAUDE.md
[test command]

# Run lint
[lint command]
```

Fix any failures before proceeding.

---

## Phase 5: Verify

### 5.1 Reproduction Now Passes

Run the exact reproduction from Phase 1:

```bash
[same reproduction command from Phase 1]
```

The bug must be gone. If it's not, return to Phase 3.

### 5.2 Regression Test

Write a test that:
1. **Would have caught the original bug** (fails without the fix)
2. **Passes with the fix**
3. **Covers the edge case** that caused the bug

```bash
# Run the new test in isolation
[test command] [new-test-name]
```

### 5.3 No New Failures

```bash
# Full test suite
[test command]
```

---

## Phase 6: Document and Close

### 6.1 Update Documentation

- [ ] If the bug revealed a gotcha --> add to `tasks/lessons.md`
- [ ] If the fix changed a pattern --> update coding rules or `AGENTS.md`
- [ ] If a dependency caused it --> document the constraint

### 6.2 Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(scope): short description of the fix

Root cause: [one-line root cause]
- [What changed and why]
- Added regression test for [scenario]

Fixes #N
EOF
)"
```

## Bundled Resources

- **`scripts/bisect.sh`** -- Git bisect helper. Run with `--help` to see usage.
  Automates bisect start/run/reset for finding the commit that introduced a bug.

## Constraints

- Never apply a fix you can't verify with a reproduction
- Never suppress errors to make a test pass
- If the root cause is in a dependency, document the workaround and file an upstream issue
- If the fix requires an architectural change, escalate to the user -- don't refactor during debugging
