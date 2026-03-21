---
name: eclipse-compound
description: >-
  Update agent documentation after a correction, new pattern discovery, or
  mistake. Implements the compound engineering feedback loop: human spots issue,
  agent updates docs, future sessions avoid the issue. Routes fixes to the
  correct knowledge file (lessons.md, lessons-pr.md, AGENTS.md, .cursor/rules/).
  Use when the user corrects the agent, discovers a new pattern, or says
  "add this to lessons", "update the docs", or "remember this".
---

# Eclipse Compound Engineering

The most important skill. Every correction compounds into better documentation.

## When Triggered

1. User corrects the agent's behavior or output
2. User discovers a new pattern or anti-pattern
3. User says "remember this", "add to lessons", "update the docs"
4. A PR review reveals a gap in documentation
5. A debugging session uncovers an undocumented gotcha

---

## Phase 0: Load Project Context

Read the existing knowledge to understand what's already documented:

1. **`tasks/lessons.md`** -- existing lessons (avoid duplicates)
2. **`tasks/lessons-pr.md`** -- existing PR-specific patterns
3. **`CLAUDE.md`** and **`AGENTS.md`** -- current project documentation
4. **Coding rules** -- current rules:
   - Cursor: `.cursor/rules/*.mdc`
   - Claude Code: subdirectory `CLAUDE.md` files

---

## Step 1: Identify the Correction

Before updating anything, understand what happened:

- **What was wrong?** (incorrect code, wrong pattern, missed anti-pattern, stale info)
- **Why was it wrong?** (missing context in agent docs, wrong rule, outdated pattern)
- **What would have prevented it?** (new rule, updated anti-pattern, additional context)

---

## Step 2: Capture the Lesson

Add an entry to the appropriate lessons file:

**General corrections** --> `tasks/lessons.md`:

```markdown
## [YYYY-MM-DD] - [Category: Pattern | Anti-Pattern | Convention | Integration | Gotcha]

**Context**: [What task was being performed]
**Correction**: [What the agent did wrong]
**Root cause**: [Why -- which missing/incorrect doc caused it]
**Fix applied**: [Which file was updated and how]
```

**PR-specific patterns** --> `tasks/lessons-pr.md`:

```markdown
## [YYYY-MM-DD] - [Section: Quality Gates | Recurring Findings | Anti-Patterns]

**Pattern**: [What to always check in PRs for this repo]
**Example**: [Concrete example from the PR that surfaced this]
**Check**: [What the reviewer should verify]
```

**Categories for lessons.md:**

| Category | When to Use | Example |
|----------|------------|---------|
| **Pattern** | New coding or architectural pattern | "Always use SQL CASE WHEN for status protection" |
| **Anti-Pattern** | Something to never do | "Never use self.reject() on Celery tasks" |
| **Convention** | Naming, structure, or process rule | "Worker logs use app.utils.logger.worker" |
| **Integration** | Cross-service or external system behavior | "QUEUED maps to is_complete=True since v1.6.3" |
| **Gotcha** | Subtle trap causing hard-to-debug issues | "CELERY_BROKER_URL env var overrides programmatic config" |

---

## Step 3: Route the Fix

Determine which file(s) need updating. For complex routing decisions, read
`references/routing-guide.md` which has a decision tree and file size budgets.

Quick reference:

| What Changed | Primary Target |
|-------------|---------------|
| Project command or setup step | Root `CLAUDE.md` |
| Architecture or layer rule | Root `CLAUDE.md` + subdirectory docs |
| File-specific coding pattern | Coding rules |
| Module-specific pattern | Subdirectory `AGENTS.md` / `CLAUDE.md` |
| PR quality gate | `tasks/lessons-pr.md` |
| Cross-tool instruction | Root `AGENTS.md` |
| Anti-pattern to avoid | Root `CLAUDE.md` anti-patterns section |

---

## Step 4: Apply the Fix

Edit the target file(s). Follow these rules:

**Content rules:**
- Keep changes minimal and precise
- Add the rule close to related existing rules
- Use the same format/style as existing entries
- Be concrete: "Use `raise Reject(str(error), requeue=False)`" not "use proper DLQ"
- Include the "why" when non-obvious

**Budget rules (don't exceed):**

| File | Max Lines |
|------|-----------|
| Root `CLAUDE.md` | 100 |
| Root `AGENTS.md` | 120 |
| Coding rules (`.cursor/rules/*.mdc` or subdirectory `CLAUDE.md`) | 150 each |
| Subdirectory `AGENTS.md` | 100 each |

**If a file is over budget**, consider:
- Moving detailed content to a coding rule file
- Moving module-specific content to subdirectory docs
- Replacing verbose entries with concise ones

---

## Step 5: Verify the Fix

- [ ] The fix addresses the root cause, not just the symptom
- [ ] A new agent session reading this doc would know exactly what to do
- [ ] No contradictions with existing rules in other files
- [ ] The rule is in the file where the agent would naturally look
- [ ] The updated file is still within its line budget
- [ ] The fix would have prevented the original mistake

**Quality bar**: Ask yourself -- "If a new agent session starts right now and
hits the same scenario, would the updated docs prevent the mistake?" If no,
the fix is insufficient.

---

## Step 6: Promote Recurring Patterns

If a lesson appears in `tasks/lessons.md` more than twice:

1. Promote it to a permanent rule in `CLAUDE.md`, `AGENTS.md`, or coding rules
2. Consolidate the lesson entries into a single reference
3. Add a note: `Promoted to [target file] on [date]`

## Bundled Resources

- **`references/routing-guide.md`** -- Decision tree for routing corrections to
  the right file. Includes file size budgets and promotion criteria. Read when
  the quick reference table above isn't specific enough.
