#!/bin/bash
# Git bisect helper for finding the commit that introduced a bug.
# Usage: ./bisect.sh --good <commit> --bad <commit> --test "<command>"
#
# Runs git bisect with the given test command to find the first bad commit.
# The test command should exit 0 for good commits and non-zero for bad ones.

set -euo pipefail

GOOD=""
BAD=""
TEST_CMD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --good) GOOD="$2"; shift 2 ;;
    --bad) BAD="$2"; shift 2 ;;
    --test) TEST_CMD="$2"; shift 2 ;;
    --help)
      echo "Usage: bisect.sh --good <commit> --bad <commit> --test \"<command>\""
      echo ""
      echo "Options:"
      echo "  --good <commit>    Last known good commit (tests pass)"
      echo "  --bad <commit>     First known bad commit (tests fail), default: HEAD"
      echo "  --test <command>   Command to run at each step (exit 0 = good, non-zero = bad)"
      echo ""
      echo "Example:"
      echo "  ./bisect.sh --good abc123 --bad HEAD --test \"pytest tests/test_auth.py\""
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$GOOD" ] || [ -z "$TEST_CMD" ]; then
  echo "ERROR: --good and --test are required. Run with --help for usage."
  exit 1
fi

BAD="${BAD:-HEAD}"

echo "=== Starting bisect ==="
echo "Good: $GOOD"
echo "Bad: $BAD"
echo "Test: $TEST_CMD"
echo ""

git bisect start "$BAD" "$GOOD"
git bisect run sh -c "$TEST_CMD"

echo ""
echo "=== Bisect complete ==="
echo "First bad commit:"
git bisect visualize --oneline 2>/dev/null || git log -1

git bisect reset
