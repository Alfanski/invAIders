#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
WORKFLOWS_DIR="$REPO_ROOT/n8n/workflows"

load_env() {
  local env_file="$REPO_ROOT/.env.local"
  if [[ ! -f "$env_file" ]]; then
    echo "Error: .env.local not found at $env_file" >&2
    echo "Copy .env.local.example and fill in N8N_BASE_URL and N8N_API_KEY" >&2
    exit 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  set +a

  if [[ -z "${N8N_BASE_URL:-}" ]]; then
    echo "Error: N8N_BASE_URL not set in .env.local" >&2
    exit 1
  fi
  if [[ -z "${N8N_API_KEY:-}" ]]; then
    echo "Error: N8N_API_KEY not set in .env.local" >&2
    exit 1
  fi
}

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -s -X "$method" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    "$@" \
    "${N8N_BASE_URL}/api/v1${path}"
}

cmd_list() {
  echo "Fetching workflows from ${N8N_BASE_URL}..."
  api GET /workflows | python3 -c "
import json, sys
data = json.load(sys.stdin)
workflows = data.get('data', data) if isinstance(data, dict) else data
if isinstance(workflows, list):
    hdr_id, hdr_active, hdr_name = 'ID', 'Active', 'Name'
    print('{:<24} {:<8} {}'.format(hdr_id, hdr_active, hdr_name))
    print('-' * 60)
    for w in workflows:
        wid = w.get('id', '?')
        name = w.get('name', '?')
        active = 'Yes' if w.get('active') else 'No'
        print('{:<24} {:<8} {}'.format(wid, active, name))
else:
    json.dump(data, sys.stdout, indent=2)
    print()
"
}

cmd_pull() {
  local target_id="${1:-}"
  mkdir -p "$WORKFLOWS_DIR"

  if [[ -n "$target_id" ]]; then
    echo "Pulling workflow $target_id..."
    local response
    response=$(api GET "/workflows/$target_id")
    local name
    name=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name','workflow'))" 2>/dev/null || echo "workflow")
    local safe_name
    safe_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
    local outfile="$WORKFLOWS_DIR/${safe_name}.json"
    echo "$response" | python3 -m json.tool > "$outfile"
    echo "Saved to $outfile"
  else
    echo "Pulling all workflows..."
    local ids
    ids=$(api GET /workflows | python3 -c "
import json, sys
data = json.load(sys.stdin)
workflows = data.get('data', data) if isinstance(data, dict) else data
if isinstance(workflows, list):
    for w in workflows:
        print(w.get('id', ''))
")
    for id in $ids; do
      local response
      response=$(api GET "/workflows/$id")
      local name
      name=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name','workflow'))" 2>/dev/null || echo "workflow")
      local safe_name
      safe_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
      local outfile="$WORKFLOWS_DIR/${safe_name}.json"
      echo "$response" | python3 -m json.tool > "$outfile"
      echo "  Saved: $outfile"
    done
    echo "Done."
  fi
}

cmd_push() {
  local file="${1:-}"
  if [[ -z "$file" ]]; then
    echo "Pushing all workflow files from $WORKFLOWS_DIR..."
    for f in "$WORKFLOWS_DIR"/*.json; do
      [[ -f "$f" ]] || continue
      push_one_file "$f"
    done
    echo "Done."
  else
    push_one_file "$file"
  fi
}

push_one_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  local workflow_id
  workflow_id=$(python3 -c "import json; d=json.load(open('$file')); print(d.get('id',''))" 2>/dev/null || echo "")
  local name
  name=$(python3 -c "import json; d=json.load(open('$file')); print(d.get('name','unknown'))" 2>/dev/null || echo "unknown")

  if [[ -n "$workflow_id" ]]; then
    echo "  Updating workflow '$name' (id: $workflow_id)..."
    local response
    response=$(api PUT "/workflows/$workflow_id" -d @"$file")
    local updated_id
    updated_id=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','?'))" 2>/dev/null || echo "?")
    echo "  Updated: $updated_id"
  else
    echo "  Creating workflow '$name'..."
    local response
    response=$(api POST /workflows -d @"$file")
    local new_id
    new_id=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','?'))" 2>/dev/null || echo "?")
    echo "  Created: $new_id"
    echo "  (Tip: pull this workflow to get the assigned ID into your local file)"
  fi
}

cmd_activate() {
  local id="${1:?Usage: sync.sh activate <workflow-id>}"
  echo "Activating workflow $id..."
  api POST "/workflows/$id/activate"
  echo ""
  echo "Activated."
}

cmd_deactivate() {
  local id="${1:?Usage: sync.sh deactivate <workflow-id>}"
  echo "Deactivating workflow $id..."
  api POST "/workflows/$id/deactivate"
  echo ""
  echo "Deactivated."
}

cmd_executions() {
  local workflow_id="${1:?Usage: sync.sh executions <workflow-id>}"
  echo "Recent executions for workflow $workflow_id:"
  api GET "/executions?workflowId=$workflow_id&limit=10" | python3 -c "
import json, sys
data = json.load(sys.stdin)
execs = data.get('data', data) if isinstance(data, dict) else data
if isinstance(execs, list):
    print('{:<24} {:<12} {:<24} {}'.format('ID', 'Status', 'Finished', 'Mode'))
    print('-' * 72)
    for e in execs:
        eid = e.get('id', '?')
        status = e.get('status', '?')
        finished = e.get('stoppedAt', e.get('finished', '?'))
        mode = e.get('mode', '?')
        print('{:<24} {:<12} {:<24} {}'.format(eid, status, str(finished), mode))
else:
    json.dump(data, sys.stdout, indent=2)
    print()
"
}

cmd_credentials() {
  echo "Credentials on ${N8N_BASE_URL}:"
  api GET /credentials | python3 -c "
import json, sys
data = json.load(sys.stdin)
creds = data.get('data', data) if isinstance(data, dict) else data
if isinstance(creds, list):
    print('{:<24} {:<30} {}'.format('ID', 'Type', 'Name'))
    print('-' * 72)
    for c in creds:
        cid = c.get('id', '?')
        ctype = c.get('type', '?')
        name = c.get('name', '?')
        print('{:<24} {:<30} {}'.format(cid, ctype, name))
else:
    json.dump(data, sys.stdout, indent=2)
    print()
"
}

usage() {
  cat <<'EOF'
n8n workflow sync -- manage n8n Cloud workflows from the repo

Usage: sync.sh <command> [args]

Commands:
  list                    List all workflows on n8n Cloud
  pull [id]               Pull workflow(s) from Cloud to n8n/workflows/
  push [file]             Push workflow JSON file(s) to Cloud (create or update)
  activate <id>           Activate a workflow
  deactivate <id>         Deactivate a workflow
  executions <id>         List recent executions for a workflow
  credentials             List available credentials (id + type + name)

Environment:
  Reads N8N_BASE_URL and N8N_API_KEY from .env.local (sourced automatically).

EOF
}

load_env

case "${1:-}" in
  list)        cmd_list ;;
  pull)        cmd_pull "${2:-}" ;;
  push)        cmd_push "${2:-}" ;;
  activate)    cmd_activate "${2:-}" ;;
  deactivate)  cmd_deactivate "${2:-}" ;;
  executions)  cmd_executions "${2:-}" ;;
  credentials) cmd_credentials ;;
  -h|--help|help|"") usage ;;
  *)
    echo "Unknown command: $1" >&2
    usage
    exit 1
    ;;
esac
