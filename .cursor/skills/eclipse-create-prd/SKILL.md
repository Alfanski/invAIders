---
name: eclipse-create-prd
description: >-
  Create product requirements documents (PRDs) and convert them into GitHub
  issues with labels, milestones, and acceptance criteria. PRDs follow a
  structured format optimized for AI agent consumption. Use when creating a PRD,
  writing requirements, planning a feature, or when the user says "create PRD",
  "write requirements", "plan feature", or "create issues from requirements".
---

# Eclipse Create PRD

Create structured PRDs and convert them into actionable GitHub issues.

---

## Phase 0: Load Project Context

Before writing requirements, understand the project:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- project architecture and conventions
2. **`tasks/lessons.md`** -- known patterns and constraints
3. **Existing PRDs** in `docs/features/` -- follow established format

---

## Phase 1: Requirements Gathering

Ask clarifying questions before writing:

1. **Problem**: What problem does this solve? Who is affected?
2. **Scope**: What's in scope? What's explicitly out of scope?
3. **Constraints**: Performance, security, compliance, timeline?
4. **Dependencies**: Other services, teams, or repos involved?
5. **Success criteria**: How do we know this is done?

---

## Phase 2: Write the PRD

Save to `docs/features/[version]/[feature-name]-prd.md`. Use the template
from `assets/prd-template.md` as a starting point -- copy and fill in.

**PRD quality rules:**
- One requirement per bullet (atomic)
- Acceptance criteria as checklists, not prose
- Explicit constraints, not implied
- Specific numbers (not "fast" -- say "< 200ms p95")

---

## Phase 3: Convert to GitHub Issues

After PRD is approved, convert each user story + technical requirement
into a GitHub issue.

### 3.1 Create Milestone

```bash
gh api repos/{owner}/{repo}/milestones \
  -f title="[Feature Name]" \
  -f description="PRD: docs/features/[version]/[feature-name]-prd.md" \
  -f state="open"
```

### 3.2 Create Tracking Epic

```bash
gh issue create \
  --title "[Feature Name] -- Implementation Tracking" \
  --label "epic,feature" \
  --milestone "[Feature Name]" \
  --body "$(cat <<'EOF'
## Overview
[1-sentence from PRD problem statement]

## PRD
See `docs/features/[version]/[feature-name]-prd.md`

## Issues
- [ ] #XX US-1: [Story title]
- [ ] #XX US-2: [Story title]
- [ ] #XX TR-1: [Technical requirement]
- [ ] #XX Documentation updates

## Success Criteria
[From PRD]
EOF
)"
```

### 3.3 Create Individual Issues

Use the template from `assets/issue-template.md` for each issue body.

```bash
gh issue create \
  --title "US-1: [Story title]" \
  --label "user-story,feature" \
  --milestone "[Feature Name]" \
  --body-file assets/issue-template.md
```

**Issue creation rules:**
- One issue per user story (atomic, independently implementable)
- Technical requirements get their own issues if substantial
- Always include acceptance criteria as checkboxes
- Always include "Agent docs updated" in Definition of Done
- Label consistently: `user-story`, `technical`, `bug`, `docs`, `epic`
- Link all issues to the milestone and tracking epic
- Reference the PRD file path in every issue

---

## Phase 4: Update Documentation

After issues are created:

- [ ] PRD committed to `docs/features/[version]/`
- [ ] Tracking issue number added to PRD header
- [ ] CLAUDE.md updated if new architectural patterns planned
- [ ] Cross-repo dependencies flagged in relevant repos

## Bundled Resources

- **`assets/prd-template.md`** -- PRD document template. Copy to
  `docs/features/[version]/[feature-name]-prd.md` and fill in.
- **`assets/issue-template.md`** -- GitHub issue body template for user stories.
  Copy and customize per issue.
