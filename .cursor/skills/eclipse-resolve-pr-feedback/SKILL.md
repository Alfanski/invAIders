---
name: eclipse-resolve-pr-feedback
description: >-
  Read a GitHub or ADO pull request, ingest all review comments and CI check
  results, then systematically address each by making code changes, fixing
  lint/test failures, replying to comment threads, and committing. Loads
  repo-specific knowledge from tasks/lessons-pr.md for context. Use when
  addressing PR feedback, fixing review comments, resolving CI failures,
  or when the user says "resolve PR feedback", "fix PR comments", or
  "address review".
---

# Eclipse Resolve PR Feedback

Systematically address all review feedback and CI failures on a pull request.

---

## Phase 0: Load Project Context

Before resolving feedback, gather repo-specific knowledge:

1. **`AGENTS.md`** and **`CLAUDE.md`** -- project architecture and standards
2. **`tasks/lessons-pr.md`** -- PR-specific patterns and recurring findings
3. **`tasks/lessons.md`** -- recent corrections
4. **Coding rules** for touched file types:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped)
   - Claude Code: subdirectory `CLAUDE.md` files (proximity-scoped)

**Context budget**: Keep Phase 0 reads under ~3,000 tokens total. Only read
rules relevant to files touched by the PR.

---

## Phase 1: Gather

Fetch all PR data in parallel:

### GitHub

```bash
# PR metadata
gh pr view <number> --json title,body,state,baseRefName,headRefName,files,reviews

# Review comments (inline + general)
gh api repos/{owner}/{repo}/pulls/<number>/comments
gh api repos/{owner}/{repo}/pulls/<number>/reviews

# CI check results
gh pr checks <number>
gh pr checks <number> --json name,state,conclusion,detailsUrl

# Full diff
gh pr diff <number>
```

**If CI checks are failing, read the logs immediately:**

```bash
# List recent runs on the PR branch
gh run list --branch <branch-name> --limit 5

# Get failed job details
gh run view <run-id> --json jobs \
  --jq '.jobs[] | select(.conclusion == "failure") | {name, conclusion}'

# Read the failed step output
gh run view <run-id> --log-failed 2>&1 | tail -200
```

### ADO (when ADO MCP is available)

```
# Find builds
user-ado-pipelines_get_builds (branchName: "refs/pull/<number>/merge")
user-ado-pipelines_get_builds (branchName: "refs/heads/<source-branch>")

# Read failing step log
user-ado-pipelines_get_build_log_by_id (buildId, logId, startLine: total-200)

# Get test results
user-ado-testplan_show_test_results_from_build_id (buildid)
```

### Classify Each Comment

| Category | Action |
|----------|--------|
| **Code Change** | Make the change |
| **Question** | Answer in reply |
| **Suggestion** | Present to user for decision |
| **Nit** | Fix it |
| **Praise** | Acknowledge |
| **Already Resolved** | Skip |

---

## Phase 2: Plan

Present a structured plan. **Wait for approval.**

```markdown
## PR Feedback Resolution Plan -- <PR title>

### Context
- **Branch**: <source> --> <target>
- **CI**: passing / failing

### Comment Threads to Address

| # | Thread | Author | Category | Planned Action |
|---|--------|--------|----------|---------------|
| 1 | "Missing type hint" | @reviewer | Code Change | Add annotation |
| 2 | "Why not gather?" | @reviewer | Question | Explain dependency |

### CI Failures to Fix

| # | Check | Error | Planned Fix |
|---|-------|-------|-------------|
| 1 | Ruff | E711 | Change == None to is None |

### Skipped
- Thread #5: Already resolved

### Needs User Input
- Thread #3: Suggestion -- address or skip?
```

---

## Phase 3: Execute

### 3.1 Address Code Comments

For each approved item:

1. Read the full file for context (not just the diff)
2. Make the change
3. Run lint (use command from CLAUDE.md)
4. Run tests (use command from CLAUDE.md)
5. Track progress in todo list

### 3.2 Fix CI/Pipeline Failures

For each failing check:

1. Read the build log to identify the exact error
2. Classify the failure:
   - **Build/compile error** --> fix source code
   - **Test failure** --> determine if test or code is wrong; fix root cause
   - **Lint/style** --> run formatter locally
   - **Security scan** --> check alert details, update dependency
   - **Infra/flaky** --> note as unrelated, suggest re-run
3. Validate locally before pushing:
   ```bash
   # Python repos
   ruff check --fix . && ruff format . && pytest

   # TypeScript repos
   npm run lint:fix && npm run format && npm test
   ```
4. After pushing, monitor re-triggered pipeline:
   ```bash
   gh run rerun <run-id> --failed
   ```

### 3.3 Documentation Check (MANDATORY)

After all code changes, verify: did any change affect architecture, commands,
or patterns? If yes, update the relevant agent docs before committing.

---

## Phase 4: Close the Loop

### 4.1 Commit and Push

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: address PR review feedback

- <summary of changes>
- Updated agent docs for [changed patterns]

Addresses review comments on PR #<number>
EOF
)"
git push
```

### 4.2 Reply to Comment Threads

Present batch to user first, then post after approval:

```bash
# Reply to a specific review comment thread
gh api repos/{owner}/{repo}/pulls/<number>/comments/<comment-id>/replies \
  -f body="Fixed in <commit-sha>. <brief explanation>"

# Post resolution summary using the template
gh pr comment <number> --body-file assets/resolution-summary.md
```

### 4.3 Re-request Review

```bash
# Re-request review from existing reviewer
gh api repos/{owner}/{repo}/pulls/<number>/requested_reviewers \
  -f "reviewers[]=<reviewer-handle>"
```

### ADO (when ADO MCP is available)

- Reply: `user-ado-repo_reply_to_comment` (threadId + content)
- Resolve: `user-ado-repo_update_pull_request_thread` (status: Fixed)
- Re-trigger CI: `user-ado-pipelines_run_pipeline` or retry stage

## Bundled Resources

- **`assets/resolution-summary.md`** -- Template for the PR resolution summary
  comment. Copy, fill in the table, and post.
