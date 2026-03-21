#!/bin/bash
file_path=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('file_path',''))")
if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.yml|*.yaml)
    npx prettier --write "$file_path" 2>/dev/null
    ;;
  *.py)
    ruff format --quiet "$file_path" 2>/dev/null
    ;;
esac
exit 0
