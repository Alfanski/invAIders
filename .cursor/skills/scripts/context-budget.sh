#!/bin/bash
# Estimate context cost of agent files in the current repo.
# Used by skills during Phase 0 to decide what to read.
# Usage: ./context-budget.sh
#
# Outputs a table of file sizes and a total, helping the agent stay within
# context budget (~3,000 tokens for Phase 0).

set -euo pipefail

total_lines=0
total_tokens_est=0

format_row() {
  local file="$1"
  local lines="$2"
  local tokens_est=$((lines * 4))
  local always_on="$3"
  printf "| %-50s | %5d | ~%5d | %-3s |\n" "$file" "$lines" "$tokens_est" "$always_on"
  total_lines=$((total_lines + lines))
  total_tokens_est=$((total_tokens_est + tokens_est))
}

echo "## Agent Context Cost"
echo ""
printf "| %-50s | %5s | %6s | %-3s |\n" "File" "Lines" "Tokens" "On?"
printf "| %-50s | %5s | %6s | %-3s |\n" "$(printf '%0.s-' {1..50})" "-----" "------" "---"

# Root docs (always on)
for f in CLAUDE.md AGENTS.md; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    format_row "$f" "$lines" "Yes"
  fi
done

# Always-apply rules
if [ -d ".cursor/rules" ]; then
  for f in .cursor/rules/*.mdc; do
    [ -f "$f" ] || continue
    if head -5 "$f" | grep -q "alwaysApply: true"; then
      lines=$(wc -l < "$f" | tr -d ' ')
      format_row "$f" "$lines" "Yes"
    fi
  done
fi

# Knowledge files (read on demand by skills)
for f in tasks/lessons.md tasks/lessons-pr.md; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    format_row "$f" "$lines" "No"
  fi
done

# Conditional rules
if [ -d ".cursor/rules" ]; then
  for f in .cursor/rules/*.mdc; do
    [ -f "$f" ] || continue
    if ! head -5 "$f" | grep -q "alwaysApply: true"; then
      lines=$(wc -l < "$f" | tr -d ' ')
      format_row "$f" "$lines" "No"
    fi
  done
fi

# Subdirectory docs
find . -mindepth 2 -name "AGENTS.md" -not -path "*/.cursor/*" -not -path "*/.claude/*" -not -path "*/node_modules/*" 2>/dev/null | sort | while read -r f; do
  lines=$(wc -l < "$f" | tr -d ' ')
  format_row "$f" "$lines" "No"
done

echo ""
printf "| %-50s | %5d | ~%5d |     |\n" "**TOTAL**" "$total_lines" "$total_tokens_est"
echo ""

# Budget assessment
always_on_lines=0
for f in CLAUDE.md AGENTS.md; do
  [ -f "$f" ] && always_on_lines=$((always_on_lines + $(wc -l < "$f" | tr -d ' ')))
done
if [ -d ".cursor/rules" ]; then
  for f in .cursor/rules/*.mdc; do
    [ -f "$f" ] || continue
    if head -5 "$f" | grep -q "alwaysApply: true"; then
      always_on_lines=$((always_on_lines + $(wc -l < "$f" | tr -d ' ')))
    fi
  done
fi

if [ "$always_on_lines" -gt 220 ]; then
  echo "WARNING: Always-on context ($always_on_lines lines) exceeds 220-line budget."
  echo "Consider slimming root docs or moving content to conditional rules."
elif [ "$always_on_lines" -gt 150 ]; then
  echo "NOTE: Always-on context ($always_on_lines lines) is approaching the 220-line budget."
else
  echo "OK: Always-on context ($always_on_lines lines) is within the 220-line budget."
fi
