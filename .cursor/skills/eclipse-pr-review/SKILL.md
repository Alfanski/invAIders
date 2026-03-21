---
name: eclipse-pr-review
description: >-
  Review pull requests for code quality, security, testing, and documentation
  completeness. Loads repo-specific knowledge from AGENTS.md, tasks/lessons-pr.md,
  and .cursor/rules/ to apply project-specific standards. Posts inline comments
  to GitHub or ADO after explicit approval. Use when reviewing PRs, examining
  diffs, or when the user asks for a code review.
---

# Eclipse PR Review

Thorough, actionable pull request reviews informed by repo-specific knowledge.

## Operating Mode

Two phases: local review first, platform posting only after explicit approval.

- **Phase 1 (Local)**: Fetch diff, analyze, present full review in chat
- **Phase 2 (Post)**: Only after user approves, post to GitHub or ADO
- **NEVER post comments to a platform without explicit user approval**

---

## Phase 0: Load Project Context

Before reviewing, gather repo-specific knowledge. Read each file if it exists:

1. **`AGENTS.md`** and **`CLAUDE.md`** -- project architecture, layer rules, commands
2. **`tasks/lessons-pr.md`** -- recurring review patterns, quality gates, anti-patterns specific to this repo
3. **`tasks/lessons.md`** -- recent corrections and patterns
4. **Coding rules** -- read rules matching the file types in the diff:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped, loaded automatically for matching files)
   - Claude Code: subdirectory `CLAUDE.md` files (loaded by proximity)
5. **Subdirectory docs** -- for each changed directory, read its `AGENTS.md` or `CLAUDE.md`

Use this context to inform your review. These files define what "correct" means
for this specific repository. If the files don't exist, proceed with universal
review standards only.

**Context budget**: Keep Phase 0 reads under ~3,000 tokens total. Read root
docs fully but only read rules/subdirectory docs relevant to changed files.

---

## Phase 1: Review

### Step 1: Understand the Change

1. Read the PR description and linked issue
2. Run `git diff [base]...HEAD --stat` for scope
3. Check CI status: `gh pr checks <number>`
   - If failing, read logs: `gh run view <run-id> --log-failed 2>&1 | tail -200`
4. Classify: feature / fix / refactor / docs / chore

### Step 2: Fetch the Diff

**Option A: Local branch diff**
```bash
git fetch origin
git diff --unified=5 --no-color origin/main...HEAD
git diff --stat origin/main...HEAD
```

**Option B: GitHub PR**
```bash
gh pr view <number> --json title,body,state,baseRefName,headRefName,files,reviews
gh pr diff <number>
gh pr checks <number>
```

**Option C: ADO PR** (when ADO MCP is available)
- `user-ado-repo_get_pull_request_by_id`
- `user-ado-repo_list_pull_request_threads`
- `user-ado-pipelines_get_build_status`

### Step 3: Code Review

For each changed file, **read the full file** (not just the diff) to understand context.

**Universal checklist** (applies to every repo):

#### Functional Correctness (highest priority)
- [ ] Requirements from linked issue are fulfilled
- [ ] Data flow is correct end-to-end through changed paths
- [ ] Logic is sound: no off-by-one, wrong operators, unreachable code
- [ ] Edge cases handled: empty inputs, None, missing keys, boundary values
- [ ] Integration points correct: function signatures, return types, contracts

#### Architecture
- [ ] Layer/module boundaries respected (check project's `AGENTS.md` / `CLAUDE.md` for rules)
- [ ] No circular imports introduced
- [ ] New dependencies justified and version-pinned

#### Code Quality
- [ ] Functions are focused and appropriately sized
- [ ] Error handling is comprehensive (no bare except, chains with `from e`)
- [ ] Type hints on all public functions
- [ ] Logging uses structured format, never f-strings
- [ ] No hardcoded secrets or credentials

#### Testing
- [ ] Tests cover new/changed code paths
- [ ] Test naming follows project conventions
- [ ] Edge cases and error paths tested
- [ ] No test relies on external services without mocking

#### Security
- [ ] No SQL injection via string interpolation
- [ ] No `eval()`, `exec()`, or `os.system()` with user input
- [ ] Sensitive data not logged (tokens, passwords, PII)
- [ ] Input validation on new endpoints or public methods

#### Documentation (MANDATORY)
- [ ] `CLAUDE.md` / `AGENTS.md` updated if architecture/commands/patterns changed
- [ ] Coding rules updated if file-specific patterns changed (`.cursor/rules/` or subdirectory `CLAUDE.md`)
- [ ] Subdirectory docs updated if module patterns changed
- [ ] `tasks/lessons.md` updated if a correction drove this change
- [ ] PR description includes "Documentation Updates" section

**Repo-specific checklist**: Apply additional checks from `tasks/lessons-pr.md`
and coding rules loaded in Phase 0. These contain patterns unique to this
project (e.g., Celery task hierarchy rules, webhook contract checks,
React component patterns).

### Step 4: Present Review

Use the template from `assets/pr-summary.md` to structure the output. The
template includes sections for verdict, hygiene, findings table, highlights,
risk assessment, and documentation check.

---

## Phase 2: Post to Platform (requires approval)

After presenting findings, ask:
> "Ready to post these to GitHub? I can post summary + inline comments, or
> tell me which to include/exclude."

**GitHub (preferred):**
```bash
gh pr review <number> --request-changes --body "<summary>"

COMMIT=$(gh pr view <number> --json headRefOid --jq '.headRefOid')
gh api repos/{owner}/{repo}/pulls/<number>/comments \
  -f body="[CRITICAL] <finding with suggested fix>" \
  -f path="src/path/to/file.py" \
  -F line=42 \
  -f side="RIGHT" \
  -f commit_id="$COMMIT"
```

**ADO (when ADO MCP is available):**
- Summary: `user-ado-repo_create_pull_request_thread` (no filePath)
- Inline: `user-ado-repo_create_pull_request_thread` (with filePath + line range)
- Resolve: `user-ado-repo_update_pull_request_thread` (status: Fixed)

---

## Bundled Resources

- **`references/review-checklist.md`** -- Extended checklist with performance,
  security, and architecture deep-dives. Read for complex PRs or when the
  abbreviated checklist above isn't specific enough.
- **`assets/pr-summary.md`** -- Template for the review output. Copy and fill in.

## Severity Guide

| Level | Criteria | Action |
|-------|----------|--------|
| **CRITICAL** | Security flaw, data loss, production crash, incorrect business logic | Must fix |
| **IMPORTANT** | Missing tests, perf issue, standards violation, incomplete requirements | Should fix |
| **MINOR** | Naming, docs, style, newer language features | Consider |
| **PRAISE** | Well-structured code, good patterns | Acknowledge |

## Constraints

- Be specific to the code shown -- no generic advice
- If subjective, say so
- If fewer than 3 real issues, keep it brief
- Keep under 800 words for standard PRs
- Start with what's done well
- Don't pile on repeated issues -- note once, say "also in X other locations"
