#!/bin/bash
cat > /dev/null
context=""
if [ -f "tasks/lessons.md" ]; then
  lines=$(wc -l < tasks/lessons.md 2>/dev/null || echo "0")
  if [ "$lines" -gt 5 ]; then
    context="Review tasks/lessons.md for recent corrections before starting work on this repo."
  fi
fi
printf '{"additional_context": "%s"}\n' "$context"
