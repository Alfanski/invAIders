---
name: n8n-workflow
description: >-
  Create, edit, deploy, and debug n8n workflows via the REST API and sync
  scripts. Manages workflow JSON as code in the repo and deploys to n8n Cloud.
  Use when the user says "create n8n workflow", "deploy workflow", "debug
  pipeline", "n8n", "push workflow", or similar.
---

# n8n Workflow Skill

End-to-end workflow for managing n8n pipelines as code. Workflows live as JSON
files in `n8n/workflows/`, are edited like any other code, and deployed to n8n
Cloud via the REST API.

---

## Phase 0: Load Context

Before working with n8n, gather project-specific knowledge:

1. **`AGENTS.md`** -- architecture overview, pipeline flow, processing statuses
2. **`tasks/lessons.md`** -- recent corrections (avoid repeating mistakes)
4. **Pipeline specs** -- read the relevant IP doc for the workflow you're building:
   - `docs/prd/IP-001c-activity-trigger.md` -- trigger (schedule/webhook)
   - `docs/prd/IP-001d-fetch-data.md` -- Strava fetch + downsample (14 nodes)
   - `docs/prd/IP-001e-ai-analysis.md` -- Gemini coaching analysis (10 nodes)
   - `docs/prd/IP-001i-voice-debrief.md` -- ElevenLabs TTS + upload

---

## Phase 1: Discover

Before creating or editing, understand what exists on n8n Cloud.

### Source credentials

All API calls require `N8N_BASE_URL` and `N8N_API_KEY` from `.env.local`.
Source the file before making any curl calls:

```bash
source .env.local
```

The sync script (`.cursor/skills/n8n-workflow/sync.sh`) sources `.env.local` automatically.

### List existing workflows

```bash
npm run n8n:list
# or
./.cursor/skills/n8n-workflow/sync.sh list
```

### List available credentials

Credential IDs are needed when referencing credentials in workflow JSON.
They must be created in the n8n Cloud UI first.

```bash
npm run n8n:credentials
# or
./.cursor/skills/n8n-workflow/sync.sh credentials
```

### Pull existing workflow to inspect

```bash
./.cursor/skills/n8n-workflow/sync.sh pull <workflow-id>
```

---

## Phase 2: Author Workflow JSON

### Workflow structure

```json
{
  "name": "02 - Fetch Activity Data",
  "nodes": [ ... ],
  "connections": { ... },
  "settings": { "executionOrder": "v1" }
}
```

Do NOT include `"id"` when creating a new workflow -- n8n assigns it.
Include `"id"` when updating an existing workflow.

### Node anatomy

Each node in the `nodes[]` array:

```json
{
  "id": "unique-uuid-here",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "Fetch Activity from Strava",
  "position": [500, 300],
  "parameters": {
    "method": "GET",
    "url": "https://www.strava.com/api/v3/activities/{{ $json.activityId }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer {{ $json.accessToken }}" }
      ]
    }
  },
  "credentials": {
    "httpHeaderAuth": { "id": "<credential-id>", "name": "<credential-name>" }
  }
}
```

### Common node types for this project

| Node Type | Purpose |
|-----------|---------|
| `n8n-nodes-base.webhook` | Receive incoming HTTP requests (Strava events) |
| `n8n-nodes-base.scheduleTrigger` | Cron/interval polling trigger |
| `n8n-nodes-base.httpRequest` | Call external APIs (Strava, Gemini, ElevenLabs, Convex) |
| `n8n-nodes-base.code` | JavaScript code execution (downsampling, data transforms) |
| `n8n-nodes-base.if` | Conditional branching (check 404, check gear, etc.) |
| `n8n-nodes-base.noOp` | No-operation placeholder |
| `n8n-nodes-base.set` | Set/transform fields |
| `n8n-nodes-base.merge` | Merge data from branches |

### Connection wiring

Connections map output slots of one node to input slots of another:

```json
{
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          { "node": "Set Status Fetching", "type": "main", "index": 0 }
        ]
      ]
    },
    "Set Status Fetching": {
      "main": [
        [
          { "node": "Fetch Activity", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

- `"main"` is the standard output type
- The outer array is output slots (index 0 = first output)
- The inner array lists all nodes connected to that output
- For IF nodes, index 0 = true branch, index 1 = false branch

### Credential references

Credentials are referenced by ID in workflow JSON. To find available IDs:

```bash
npm run n8n:credentials
```

Then reference in a node:

```json
"credentials": {
  "httpHeaderAuth": { "id": "abc123", "name": "Strava Token" }
}
```

Credentials must be created in the n8n Cloud UI -- the API cannot set secret values.

### Position conventions

- Start trigger node at `[250, 300]`
- Space nodes 250px apart horizontally: `[500, 300]`, `[750, 300]`, etc.
- Branch nodes vertically: true at `y=300`, false at `y=500`
- Keep positions reasonable so the visual editor stays usable

### Node ID generation

Use UUIDs for node IDs. Generate them with:

```bash
python3 -c "import uuid; print(str(uuid.uuid4()))"
```

---

## Phase 3: Deploy

### Push to n8n Cloud

```bash
# Push all local workflow files
npm run n8n:push

# Push a specific file
./.cursor/skills/n8n-workflow/sync.sh push n8n/workflows/02-fetch-activity.json
```

For new workflows (no `"id"` field), this creates the workflow on Cloud.
For existing workflows (has `"id"`), this updates the workflow on Cloud.

### Activate the workflow

```bash
./.cursor/skills/n8n-workflow/sync.sh activate <workflow-id>
```

### After creating a new workflow

Pull it back to get the assigned ID into your local file:

```bash
./.cursor/skills/n8n-workflow/sync.sh pull <workflow-id>
```

---

## Phase 4: Verify

### Check execution history

```bash
./.cursor/skills/n8n-workflow/sync.sh executions <workflow-id>
```

### Inspect a specific execution

```bash
source .env.local
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/executions/<execution-id>" | python3 -m json.tool
```

Look for `"status": "error"` and inspect `"data"` for error messages on
individual nodes.

### Common issues

- **"Unknown credential"** -- credential ID doesn't exist; run `npm run n8n:credentials`
- **Connection errors** -- check node names match exactly in `connections` keys
- **Missing parameters** -- check `typeVersion` matches the node version on Cloud

---

## Phase 5: Commit

After deploying and verifying, commit the workflow JSON:

```bash
git add n8n/workflows/
git commit -m "feat(n8n): add fetch-activity workflow (IP-001d)"
```

Use conventional commit format. Reference the IP doc in the commit message.

---

## Direct API Reference

For operations not covered by the sync script, use curl directly.
Always source `.env.local` first:

```bash
source .env.local
```

| Operation | Command |
|-----------|---------|
| List workflows | `curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows"` |
| Get workflow | `curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows/<id>"` |
| Create workflow | `curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" -d @file.json "$N8N_BASE_URL/api/v1/workflows"` |
| Update workflow | `curl -s -X PUT -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" -d @file.json "$N8N_BASE_URL/api/v1/workflows/<id>"` |
| Delete workflow | `curl -s -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows/<id>"` |
| Activate | `curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows/<id>/activate"` |
| Deactivate | `curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows/<id>/deactivate"` |
| List executions | `curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/executions?workflowId=<id>&limit=10"` |
| Get execution | `curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/executions/<id>"` |
| List credentials | `curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/credentials"` |

---

## Anti-Patterns

- Never hardcode API keys in workflow JSON or scripts -- always use `.env.local`
- Never push without pulling first if someone might have edited on Cloud
- Never include credential secret values in workflow JSON (only IDs)
- Don't create workflows with duplicate names -- use unique descriptive names
- Don't skip the pull-after-create step -- you need the assigned ID locally
