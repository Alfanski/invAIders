---
name: vercel-cli-with-tokens
description: Deploy and manage projects on Vercel with the CLI — authentication via user-created access token (VERCEL_TOKEN), linking, and env management. Use for "deploy to vercel", "set up vercel", "vercel auth", "add environment variables to vercel".
metadata:
  author: vercel
  version: "1.2.0"
---

# Vercel CLI with Tokens

Deploy and manage projects on Vercel using the CLI. This skill covers **authentication first**, then token-based and linked-project workflows.

## Authentication setup

The Vercel CLI authenticates with **`VERCEL_TOKEN` only** (no `vercel login` in this workflow). **The agent must never invent, guess, or reuse a token from earlier context.** Valid sources:

1. **`VERCEL_TOKEN` is already set** in the environment (CI secrets, shell profile, etc.), or
2. **The user** creates an access token in the dashboard and supplies it (ideally by writing it to a local gitignored file themselves).

### User-created access token

1. The user creates a token in the Vercel dashboard: [vercel.com/account/tokens](https://vercel.com/account/tokens).
2. They **must** supply the secret value — the agent cannot obtain it without the user.
3. **Do not** commit tokens, paste them into `AGENTS.md`, skills, or other tracked files. **Do not** pass tokens as `--token` on the command line (shell history and process listings).

**Recommended repo-local pattern** (when `.gitignore` includes `.env`, `.env.*`, or `.env.local`):

Create `.env.local` (or another ignored file) with:

```bash
# User replaces with their real token from the dashboard
export VERCEL_TOKEN='<USER_PASTES_TOKEN_HERE>'
```

Load before CLI commands:

```bash
set -a && source .env.local && set +a   # bash/zsh
vercel whoami                            # should print the Vercel username
```

Confirm the file is ignored:

```bash
git check-ignore -v .env.local
```

If there is no token anywhere, **stop** and ask the user to create one at [vercel.com/account/tokens](https://vercel.com/account/tokens) and set `VERCEL_TOKEN` (gitignored file or env). Do not proceed as if authenticated.

---

## Step 1: Locate the Vercel Token

After **`VERCEL_TOKEN` is available** in the environment, or when resolving “where is the token?”, work through these scenarios in order:

### A) `VERCEL_TOKEN` is already set in the environment

```bash
printenv VERCEL_TOKEN
```

If this returns a value, you're ready. Skip to Step 2.

### B) Token is in a gitignored env file under `VERCEL_TOKEN`

Check `.env`, `.env.local`, and other ignored env files (respecting repo `.gitignore`):

```bash
grep '^VERCEL_TOKEN=' .env .env.local 2>/dev/null
```

If found, export it (example for `.env.local`):

```bash
set -a && source .env.local && set +a
# or: export VERCEL_TOKEN=$(grep '^VERCEL_TOKEN=' .env.local | cut -d= -f2-)
```

### C) Token is in a `.env` file under a different name

Look for any variable that looks like a Vercel token (dashboard tokens often use prefixes such as `vca_` or `vcp_` — formats change; treat any long secret as sensitive):

```bash
grep -i 'vercel' .env .env.local 2>/dev/null
```

Inspect the output to identify which variable holds the token, then export it as `VERCEL_TOKEN`:

```bash
export VERCEL_TOKEN=$(grep '^<VARIABLE_NAME>=' .env | cut -d= -f2-)
```

### D) No token found — ask the user

If none of the above yield a token, **stop and ask the user** to create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens) and add it to a **gitignored** file (see **Authentication setup**) or set `VERCEL_TOKEN` in their environment. Do not fabricate a token or assume credentials exist.

---

**Important:** Once `VERCEL_TOKEN` is exported as an environment variable, the Vercel CLI reads it natively — **do not pass it as a `--token` flag**. Putting secrets in command-line arguments exposes them in shell history and process listings.

```bash
# Bad — token visible in shell history and process listings
vercel deploy --token "vca_abc123"

# Good — CLI reads VERCEL_TOKEN from the environment
export VERCEL_TOKEN="vca_abc123"
vercel deploy
```

## Step 2: Locate the Project and Team

Similarly, check for the project ID and team scope. These let the CLI target the right project without needing `vercel link`.

```bash
# Check environment
printenv VERCEL_PROJECT_ID
printenv VERCEL_ORG_ID

# Or check .env
grep -i 'vercel' .env 2>/dev/null
```

**If you have a project URL** (e.g. `https://vercel.com/my-team/my-project`), extract the team slug:

```bash
# e.g. "my-team" from "https://vercel.com/my-team/my-project"
echo "$PROJECT_URL" | sed 's|https://vercel.com/||' | cut -d/ -f1
```

**If you have both `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` in your environment**, export them — the CLI will use these automatically and skip any `.vercel/` directory:

```bash
export VERCEL_ORG_ID="<org-id>"
export VERCEL_PROJECT_ID="<project-id>"
```

Note: `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` must be set together — setting only one causes an error.

## CLI Setup

Ensure the Vercel CLI is installed:

```bash
npm install -g vercel
vercel --version
```

## Deploying a Project

Always deploy as **preview** unless the user explicitly requests production. Choose a method based on what you have available.

### Quick Deploy (have project ID — no linking needed)

When `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are set in the environment, deploy directly:

```bash
vercel deploy -y --no-wait
```

With a team scope (either via `VERCEL_ORG_ID` or `--scope`):

```bash
vercel deploy --scope <team-slug> -y --no-wait
```

Production (only when explicitly requested):

```bash
vercel deploy --prod --scope <team-slug> -y --no-wait
```

Check status:

```bash
vercel inspect <deployment-url>
```

### Full Deploy Flow (no project ID — need to link)

Use this when you have a token and team but no pre-existing project ID.

#### Check project state first

```bash
# Does the project have a git remote?
git remote get-url origin 2>/dev/null

# Is it already linked to a Vercel project?
cat .vercel/project.json 2>/dev/null || cat .vercel/repo.json 2>/dev/null
```

#### Link the project

**With git remote (preferred):**

```bash
vercel link --repo --scope <team-slug> -y
```

Reads the git remote and connects to the matching Vercel project. Creates `.vercel/repo.json`. More reliable than plain `vercel link`, which matches by directory name.

**Without git remote:**

```bash
vercel link --scope <team-slug> -y
```

Creates `.vercel/project.json`.

**Link to a specific project by name:**

```bash
vercel link --project <project-name> --scope <team-slug> -y
```

If the project is already linked, check `orgId` in `.vercel/project.json` or `.vercel/repo.json` to verify it matches the intended team.

#### Deploy after linking

**A) Git Push Deploy — has git remote (preferred)**

Git pushes trigger automatic Vercel deployments.

1. **Ask the user before pushing.** Never push without explicit approval.
2. Commit and push:
   ```bash
   git add .
   git commit -m "deploy: <description of changes>"
   git push
   ```
3. Vercel builds automatically. Non-production branches get preview deployments.
4. Retrieve the deployment URL:
   ```bash
   sleep 5
   vercel ls --format json --scope <team-slug>
   ```
   Find the latest entry in the `deployments` array.

**B) CLI Deploy — no git remote**

```bash
vercel deploy --scope <team-slug> -y --no-wait
```

Check status:

```bash
vercel inspect <deployment-url>
```

### Deploying from a Remote Repository (code not cloned locally)

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd <repo-name>
   ```
2. Link to Vercel:
   ```bash
   vercel link --repo --scope <team-slug> -y
   ```
3. Deploy via git push (if you have push access) or CLI deploy.

### About `.vercel/` Directory

A linked project has either:
- `.vercel/project.json` — from `vercel link`. Contains `projectId` and `orgId`.
- `.vercel/repo.json` — from `vercel link --repo`. Contains `orgId`, `remoteName`, and a `projects` map.

Not needed when `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` are both set in the environment.

**Do NOT** run `vercel ls`, `vercel project inspect`, or `vercel link` in an unlinked directory to detect state — they will interactively prompt or silently link as a side-effect. With **`VERCEL_TOKEN` set**, `vercel whoami` is the low-impact way to confirm auth without linking.

## Managing Environment Variables

```bash
# Set for all environments
echo "value" | vercel env add VAR_NAME --scope <team-slug>

# Set for a specific environment (production, preview, development)
echo "value" | vercel env add VAR_NAME production --scope <team-slug>

# List environment variables
vercel env ls --scope <team-slug>

# Pull env vars to local .env file
vercel env pull --scope <team-slug>

# Remove a variable
vercel env rm VAR_NAME --scope <team-slug> -y
```

## Inspecting Deployments

```bash
# List recent deployments
vercel ls --format json --scope <team-slug>

# Inspect a specific deployment
vercel inspect <deployment-url>

# View build logs
vercel logs <deployment-url>
```

## Managing Domains

```bash
# List domains
vercel domains ls --scope <team-slug>

# Add a domain to the project
vercel domains add <domain> --scope <team-slug>
```

## Working Agreement

- **Tokens are user-supplied.** The user creates them in the Vercel dashboard (or CI admin stores them as secrets). Never invent tokens or write a real token into tracked repository files, skills, or docs.
- **Never pass `VERCEL_TOKEN` as a `--token` flag.** Export it as an environment variable and let the CLI read it natively.
- **Check the environment for tokens before asking the user.** Look in the current env and gitignored `.env` / `.env.local` files first.
- **Default to preview deployments.** Only deploy to production when explicitly asked.
- **Ask before pushing to git.** Never push commits without the user's approval.
- **Do not read or modify `.vercel/` files directly.** The CLI manages this directory.
- **Do not curl/fetch deployed URLs to verify.** Just return the link to the user.
- **Use `--format json`** when structured output will help with follow-up steps.
- **Use `-y`** on commands that prompt for confirmation to avoid interactive blocking.

## Troubleshooting

### Token not found

Check the environment and any local env files (including `.env.local`):

```bash
printenv | grep -i vercel
grep -i vercel .env .env.local 2>/dev/null
```

If still empty, follow **Authentication setup** and ask the user to create a token and set `VERCEL_TOKEN`.

### Authentication error

If the CLI fails with `Authentication required`:
- The token may be expired or invalid.
- Verify: `vercel whoami` (uses `VERCEL_TOKEN` from environment).
- Ask the user for a fresh token.

### Wrong team

Verify the scope is correct:

```bash
vercel whoami --scope <team-slug>
```

### Build failure

Check the build logs:

```bash
vercel logs <deployment-url>
```

Common causes:
- Missing dependencies — ensure `package.json` is complete and committed.
- Missing environment variables — add with `vercel env add`.
- Framework misconfiguration — check `vercel.json`. Vercel auto-detects frameworks (Next.js, Remix, Vite, etc.) from `package.json`; override with `vercel.json` if detection is wrong.

### CLI not installed

```bash
npm install -g vercel
```
