#!/bin/bash
# Automated documentation audit checks.
# Usage: ./audit.sh [--quick | --full]
#
# Quick mode: checks file existence, line budgets, and broken references.
# Full mode: also verifies commands and checks for stale patterns.

set -euo pipefail

MODE="${1:---quick}"

echo "## Documentation Audit"
echo ""

errors=0
warnings=0

check_exists() {
  local file="$1"
  local required="$2"
  if [ -f "$file" ]; then
    echo "OK: $file exists"
  elif [ "$required" = "required" ]; then
    echo "ERROR: $file missing"
    errors=$((errors + 1))
  else
    echo "WARN: $file not found (optional)"
    warnings=$((warnings + 1))
  fi
}

check_budget() {
  local file="$1"
  local max="$2"
  if [ -f "$file" ]; then
    local lines
    lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$max" ]; then
      echo "OVER: $file is $lines lines (budget: $max)"
      warnings=$((warnings + 1))
    else
      echo "OK: $file is $lines/$max lines"
    fi
  fi
}

echo "### Required Files"
check_exists "CLAUDE.md" "required"
check_exists "AGENTS.md" "required"
check_exists "tasks/lessons.md" "required"
check_exists "tasks/lessons-pr.md" "required"
check_exists ".cursor/rules/compound-engineering.mdc" "required"
check_exists ".cursor/framework-version" "optional"
echo ""

echo "### Line Budgets"
check_budget "CLAUDE.md" 100
check_budget "AGENTS.md" 120
for f in .cursor/rules/*.mdc; do
  [ -f "$f" ] && check_budget "$f" 150
done
echo ""

echo "### Skills Deployed"
skill_count=0
for skill in .cursor/skills/eclipse-*/SKILL.md; do
  if [ -f "$skill" ]; then
    skill_count=$((skill_count + 1))
    echo "OK: $skill"
  fi
done
echo "Total: $skill_count skills"
if [ "$skill_count" -lt 10 ]; then
  echo "WARN: Expected 10 skills, found $skill_count"
  warnings=$((warnings + 1))
fi
echo ""

echo "### Claude Code Skills"
claude_count=0
for skill in .claude/skills/eclipse-*; do
  if [ -L "$skill" ] || [ -d "$skill" ]; then
    claude_count=$((claude_count + 1))
  fi
done
echo "Total: $claude_count Claude Code skills"
echo ""

echo "### Hooks"
check_exists ".claude/settings.json" "required"
check_exists ".cursor/hooks.json" "required"
for script in .cursor/hooks/*.sh; do
  if [ -f "$script" ]; then
    if [ -x "$script" ]; then
      echo "OK: $script (executable)"
    else
      echo "WARN: $script exists but not executable"
      warnings=$((warnings + 1))
    fi
  fi
done
echo ""

if [ "$MODE" = "--full" ]; then
  echo "### File References"
  for doc in CLAUDE.md AGENTS.md; do
    if [ -f "$doc" ]; then
      while IFS= read -r path; do
        clean=$(echo "$path" | sed 's/[`*]//g' | tr -d ' ')
        if [ -n "$clean" ] && [ ! -e "$clean" ]; then
          echo "WARN: $doc references $clean but it doesn't exist"
          warnings=$((warnings + 1))
        fi
      done < <(grep -oE '`[a-zA-Z0-9_./-]+\.[a-zA-Z]+`' "$doc" | sed 's/`//g' | sort -u)
    fi
  done
  echo ""
fi

echo "### Summary"
echo "Errors: $errors"
echo "Warnings: $warnings"

if [ "$errors" -gt 0 ]; then
  echo "Status: NEEDS ATTENTION"
  exit 1
elif [ "$warnings" -gt 0 ]; then
  echo "Status: OK with warnings"
else
  echo "Status: HEALTHY"
fi
