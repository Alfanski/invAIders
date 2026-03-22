#!/usr/bin/env bash
# Syncs environment variables from the current shell environment to n8n Cloud
# as workflow variables (accessible via $vars.KEY in n8n expressions).
#
# Required env vars:
#   N8N_BASE_URL  – n8n Cloud instance URL
#   N8N_API_KEY   – n8n Cloud API key
#
# Usage:
#   GROQ_API_KEY=xxx ./scripts/sync-n8n-env.sh GROQ_API_KEY CONVEX_WEBHOOK_SECRET

set -euo pipefail

: "${N8N_BASE_URL:?N8N_BASE_URL is required}"
: "${N8N_API_KEY:?N8N_API_KEY is required}"

AUTH_HEADER="X-N8N-API-KEY: ${N8N_API_KEY}"

if [ $# -eq 0 ]; then
  echo "Usage: $0 VAR_NAME [VAR_NAME ...]" >&2
  exit 1
fi

echo "Fetching existing n8n variables..."
existing=$(curl -sf -H "${AUTH_HEADER}" "${N8N_BASE_URL}/api/v1/variables")

errors=0

for var_name in "$@"; do
  var_value="${!var_name:-}"
  if [ -z "${var_value}" ]; then
    echo "::warning::${var_name} is empty or unset in the environment — skipping"
    continue
  fi

  # Find existing variable ID by key
  var_id=$(echo "${existing}" | VAR_NAME="${var_name}" python3 -c "
import json, sys, os
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('data', [])
name = os.environ['VAR_NAME']
for v in items:
    if v.get('key') == name:
        print(v['id'])
        break
" 2>/dev/null || true)

  payload=$(VAR_NAME="${var_name}" VAR_VALUE="${var_value}" python3 -c "
import json, os
print(json.dumps({'key': os.environ['VAR_NAME'], 'value': os.environ['VAR_VALUE']}))
")

  if [ -n "${var_id}" ]; then
    echo "Updating ${var_name} (id: ${var_id})..."
    http_code=$(curl -s -o /tmp/n8n_var_resp.json -w "%{http_code}" -X PATCH \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      "${N8N_BASE_URL}/api/v1/variables/${var_id}")
  else
    echo "Creating ${var_name}..."
    http_code=$(curl -s -o /tmp/n8n_var_resp.json -w "%{http_code}" -X POST \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      "${N8N_BASE_URL}/api/v1/variables")
  fi

  if [ "${http_code}" -ge 200 ] && [ "${http_code}" -lt 300 ]; then
    echo "  done: ${var_name}"
  else
    echo "::error::Failed to sync ${var_name} (HTTP ${http_code}): $(cat /tmp/n8n_var_resp.json)"
    errors=$((errors + 1))
  fi
done

if [ "${errors}" -gt 0 ]; then
  echo "::error::${errors} n8n variable(s) failed to sync"
  exit 1
fi

echo "All n8n variables synced."
