# Lessons Learned

Patterns discovered through corrections. Review before major tasks.

Skills read this file for context. Add entries when the agent makes a mistake
or you discover a pattern worth remembering.

<!-- Add entries using this format:

## [YYYY-MM-DD] - [Category: Pattern | Anti-Pattern | Convention | Integration | Gotcha]

**Context**: [What task was being performed]
**Correction**: [What the agent did wrong]
**Root cause**: [Why — which missing/incorrect doc caused it]
**Fix applied**: [Which file was updated and how]

-->

## 2026-03-21 - Anti-Pattern

**Context**: Creating the initial project plan during ideation phase
**Correction**: Agent created `tasks/plan.md` instead of using `docs/prd/PRD-001-*.md`. Had to restructure later.
**Root cause**: Agent did not read existing skills (`eclipse-create-prd`) or framework conventions before creating files. The `create-prd` skill and `AGENTS.md` documentation map were already set up with the correct structure.
**Fix applied**: Moved plan to `docs/prd/PRD-001-coachagent-mvp.md`, created `docs/index.md`, populated `AGENTS.md`. Rule: always read skills and existing framework scaffolding before creating any new files or docs.
