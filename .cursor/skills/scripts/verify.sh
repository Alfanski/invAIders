#!/bin/bash
# Verify that tests and lint pass. Used by implement, debug, refactor, and test skills.
# Usage: ./verify.sh [--tests-only | --lint-only]
#
# Detects the project type (Python/TypeScript) and runs the appropriate
# commands. Falls back to commands from CLAUDE.md if detection fails.

set -euo pipefail

MODE="${1:-all}"

detect_project_type() {
  if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
    echo "python"
  elif [ -f "package.json" ]; then
    echo "typescript"
  else
    echo "unknown"
  fi
}

run_tests() {
  local ptype
  ptype=$(detect_project_type)

  case "$ptype" in
    python)
      if command -v poetry &>/dev/null && [ -f "poetry.lock" ]; then
        poetry run pytest 2>&1
      elif command -v pytest &>/dev/null; then
        pytest 2>&1
      else
        python -m pytest 2>&1
      fi
      ;;
    typescript)
      npm test 2>&1
      ;;
    *)
      echo "ERROR: Could not detect project type. Run test command from CLAUDE.md manually."
      return 1
      ;;
  esac
}

run_lint() {
  local ptype
  ptype=$(detect_project_type)

  case "$ptype" in
    python)
      if command -v ruff &>/dev/null; then
        ruff check . 2>&1
      elif command -v poetry &>/dev/null; then
        poetry run ruff check . 2>&1
      else
        echo "WARN: ruff not found. Run lint command from CLAUDE.md manually."
      fi
      ;;
    typescript)
      npm run lint 2>&1 || npx eslint . 2>&1
      ;;
    *)
      echo "ERROR: Could not detect project type. Run lint command from CLAUDE.md manually."
      return 1
      ;;
  esac
}

echo "=== Project type: $(detect_project_type) ==="

case "$MODE" in
  --tests-only)
    echo "=== Running tests ==="
    run_tests
    ;;
  --lint-only)
    echo "=== Running lint ==="
    run_lint
    ;;
  all)
    echo "=== Running lint ==="
    run_lint
    echo ""
    echo "=== Running tests ==="
    run_tests
    ;;
  *)
    echo "Usage: verify.sh [--tests-only | --lint-only]"
    exit 1
    ;;
esac
