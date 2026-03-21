#!/bin/bash
input=$(cat)
is_first=$(echo "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('is_first_compaction',False))" 2>/dev/null || echo "false")
msg=""
if [ "$is_first" = "True" ]; then
  msg="Context compacting. After compaction, re-read CLAUDE.md and tasks/lessons.md to restore project context."
fi
printf '{"user_message": "%s"}\n' "$msg"
