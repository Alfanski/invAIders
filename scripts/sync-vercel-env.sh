#!/usr/bin/env bash
# Syncs environment variables from the current shell environment to a Vercel
# project via the REST API (upsert: create or update).
#
# Required env vars:
#   VERCEL_TOKEN       – Vercel API token
#   VERCEL_PROJECT_ID  – Vercel project ID (prj_...)
#   VERCEL_TEAM_ID     – Vercel team ID (team_...)
#
# Usage:
#   STRAVA_CLIENT_SECRET=xxx ./scripts/sync-vercel-env.sh \
#       STRAVA_CLIENT_SECRET SESSION_SECRET GROQ_API_KEY

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"
: "${VERCEL_TEAM_ID:?VERCEL_TEAM_ID is required}"

API_BASE="https://api.vercel.com"
AUTH_HEADER="Authorization: Bearer ${VERCEL_TOKEN}"

if [ $# -eq 0 ]; then
  echo "Usage: $0 VAR_NAME [VAR_NAME ...]" >&2
  exit 1
fi

echo "Fetching existing env vars from Vercel..."
existing=$(curl -sf \
  -H "${AUTH_HEADER}" \
  "${API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}")

errors=0

for var_name in "$@"; do
  var_value="${!var_name:-}"
  if [ -z "${var_value}" ]; then
    echo "::warning::${var_name} is empty or unset in the environment — skipping"
    continue
  fi

  # Find the existing env var ID that includes 'production' in its targets
  env_id=$(echo "${existing}" | VAR_NAME="${var_name}" python3 -c "
import json, sys, os
data = json.load(sys.stdin)
name = os.environ['VAR_NAME']
for e in data.get('envs', []):
    if e['key'] == name and 'production' in e.get('target', []):
        print(e['id'])
        break
" 2>/dev/null || true)

  # Build JSON payload safely via Python (handles any special chars in value)
  if [ -n "${env_id}" ]; then
    echo "Updating ${var_name} (id: ${env_id})..."
    payload=$(VAR_VALUE="${var_value}" python3 -c "
import json, os
print(json.dumps({'value': os.environ['VAR_VALUE'], 'type': 'encrypted'}))
")
    http_code=$(curl -s -o /tmp/vercel_resp.json -w "%{http_code}" -X PATCH \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      "${API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/env/${env_id}?teamId=${VERCEL_TEAM_ID}")
  else
    echo "Creating ${var_name}..."
    payload=$(VAR_NAME="${var_name}" VAR_VALUE="${var_value}" python3 -c "
import json, os
print(json.dumps({
    'key': os.environ['VAR_NAME'],
    'value': os.environ['VAR_VALUE'],
    'target': ['production'],
    'type': 'encrypted',
}))
")
    http_code=$(curl -s -o /tmp/vercel_resp.json -w "%{http_code}" -X POST \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      "${API_BASE}/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}")
  fi

  if [ "${http_code}" -ge 200 ] && [ "${http_code}" -lt 300 ]; then
    echo "  done: ${var_name}"
  else
    echo "::error::Failed to sync ${var_name} (HTTP ${http_code}): $(cat /tmp/vercel_resp.json)"
    errors=$((errors + 1))
  fi
done

if [ "${errors}" -gt 0 ]; then
  echo "::error::${errors} env var(s) failed to sync"
  exit 1
fi

echo "All env vars synced to Vercel."
