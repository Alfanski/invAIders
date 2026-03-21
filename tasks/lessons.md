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

## 2026-03-21 - Gotcha

**Context**: Deploying Next.js app to Vercel via CLI
**Correction**: Agent detected `VERCEL_TOKEN` in env but did not verify it was valid (it was a placeholder). Lost time on multiple failed `vercel whoami` calls that triggered unwanted browser login flows.
**Root cause**: Did not inspect token value or try a non-interactive API call first. Should have immediately tested with `CI=1` and `--token` flag, and asked user for a fresh token if auth failed.
**Fix applied**: Always use `CI=1` with Vercel CLI to prevent browser login. Never run `vercel whoami` without `CI=1`. If token fails, ask user immediately.

## 2026-03-21 - Gotcha

**Context**: Vercel CLI deploy to existing team project `invaiders`
**Correction**: Existing project had a team configuration issue that silently failed all CLI deploys (0ms build, no logs, `errorLink` pointing to team-configuration docs). Creating a new project `coachagent` under the same team worked immediately.
**Root cause**: The original `invaiders` project had `"framework": null` and possibly restrictive team deploy settings. The error was not surfaced by CLI output -- had to query the deployments API to find `errorLink`.
**Fix applied**: Created fresh project `coachagent` on Vercel. Vercel project name is now `coachagent` under team `lorenzohackathon-invaiders`. Use `vercel inspect` + API for debugging silent deploy failures.
