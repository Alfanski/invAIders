#!/bin/bash
file_path=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('file_path',''))")
[ -n "$file_path" ] && ruff format --quiet "$file_path" 2>/dev/null
exit 0
