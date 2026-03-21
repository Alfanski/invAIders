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

## 2026-03-21 - Gotcha

**Context**: Adding Vercel env vars for `preview` scope via CLI
**Correction**: The CLI (`v50.34.3`) prompts for a git branch when adding preview env vars. The `--value` and `--yes` flags it suggests in the error output do not actually bypass the prompt -- it's a CLI bug.
**Root cause**: Vercel CLI v50+ has an unresolved interactive prompt for preview env vars that cannot be bypassed non-interactively.
**Fix applied**: Use the Vercel REST API directly for preview-scoped env vars:

```
curl -X POST "https://api.vercel.com/v10/projects/{projectId}/env?teamId={teamId}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"VAR_NAME","value":"VAR_VALUE","target":["preview"],"type":"encrypted"}'
```

## 2026-03-21 - Gotcha

**Context**: Changing Vercel project production branch programmatically
**Correction**: Tried multiple PATCH API field names (`gitRepository`, `productionDeploymentBranch`) -- none worked. The Vercel REST API does not expose the production branch as an updatable field.
**Root cause**: Vercel's v9 projects PATCH endpoint has strict validation and the production branch is only settable via the dashboard (Settings → Environments → Production).
**Fix applied**: Change production branch in the Vercel dashboard only. Document this as a manual step in deployment guides.

## 2026-03-21 - Pattern

**Context**: Deploying a POC branch as a separate Vercel project
**Correction**: Agent over-complicated the setup by trying production deploys, then reverting. A simpler flow: create project via CLI, set env vars for all scopes, push to branch, let Git Integration handle deploys.
**Root cause**: No established pattern for multi-project Vercel setups in the docs.
**Fix applied**: Documented the pattern in AGENTS.md. Key steps: (1) `vercel link --project <name>` to create, (2) set env vars per scope (use REST API for preview), (3) set production branch in dashboard, (4) push to branch.

## 2026-03-21 - Gotcha

**Context**: Dashboard logout button causes session loss on tab change (bug recurred twice)
**Correction**: Next.js `<Link>` component prefetches its target in production. When used for `/api/auth/logout`, the prefetch hits the logout route which clears the session cookie via `Set-Cookie: maicoach_session=; Max-Age=0`. This silently logs the user out, making every subsequent tab change redirect to login.
**Root cause**: Using `<Link>` from `next/link` for API route endpoints that have side effects (logout deletes the cookie). Only manifests in production because dev mode does not aggressively prefetch.
**Fix applied**: Use a plain `<a>` tag for logout links (or any link to API routes with side effects). Added a code comment explaining why `<a>` must be used. Never use Next.js `<Link>` for API routes that modify cookies or have side effects.

## 2026-03-21 - Gotcha

**Context**: `vercel.json` `env` block overrides dashboard environment variables
**Correction**: Environment variables set in `vercel.json` take precedence over those configured in the Vercel dashboard. The `STRAVA_REDIRECT_URI` and `STRAVA_CLIENT_ID` were hardcoded in `vercel.json` pointing to an old project (`strava-webhook-poc`), silently overriding the correct values set in the dashboard.
**Root cause**: `vercel.json` env values are not encrypted and committed to git. They override dashboard-set env vars without warning.
**Fix applied**: Removed the `env` block from `vercel.json`. All environment variables should be managed exclusively via the Vercel dashboard where they are encrypted. Never put credentials or environment-specific values in `vercel.json`.

## 2026-03-21 - Gotcha

**Context**: Deploying n8n workflow via REST API with node-level settings and updated code
**Correction**: The n8n public API PUT `/workflows/:id` returns `400: request/body/id is read-only` when the body includes `id` or `active` fields. Additionally, node-level settings (`onError`, `retryOnFail`, `maxTries`, `waitBetweenTries`) are silently stripped from the response.
**Root cause**: The n8n OpenAPI schema marks `id` and `active` as read-only fields. These must be stripped before PUT requests. Node-level error/retry settings are not part of the schema and can only be set via the n8n UI. This was a known issue (GitHub #18574) partially fixed in v1.119.0 for `parameters`, but node-level settings like `onError` remain unsupported.
**Fix applied**: Updated `sync.sh` `push_one_file()` to strip `id`, `active`, `createdAt`, `updatedAt` before PUT. For resilience without `onError`/`retryOnFail`, use workflow-level patterns instead: IF nodes to skip nodes that might fail (e.g., skip Fetch Streams for manual activities), and Wait nodes to space out rate-limited API calls.
