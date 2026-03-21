# invAIders

## Overview

This is the invAIders project repository. This file provides cross-tool agent
context consumed by Cursor, Claude Code, Copilot, and other AI coding assistants.

## Commands

<!-- Add project-specific commands here as the codebase develops -->
<!-- Examples:
- **Test**: `pytest`
- **Lint**: `ruff check .`
- **Format**: `ruff format .`
-->

## Architecture

<!-- Document the project architecture here -->

## Key Patterns

<!-- Document important coding patterns here -->

## Anti-Patterns

<!-- Document things to avoid here -->

## Agent Framework

This repo uses the [Eclipse Agentic Framework](https://github.com/pwc-gx-ifs-eclipse/eclipse-agentic-framework) (v0.1.0).

### Skills Available

| Skill | Trigger |
|-------|---------|
| pr-review | "Review this PR", "code review" |
| implement | "Implement issue #N", "build this" |
| compound | "Remember this", "add to lessons" |
| audit-docs | "Audit the docs" |
| resolve-pr-feedback | "Resolve PR feedback" |
| create-prd | "Create a PRD" |
| debug | "Debug this", "why is this failing" |
| refactor | "Refactor", "clean up" |
| test | "Write tests", "add test coverage" |
| research | "How does this work", "explain the architecture" |

### Knowledge Files

| Path | Purpose |
|------|---------|
| `AGENTS.md` | This file -- cross-tool project context |
| `CLAUDE.md` | Claude Code / Cursor workspace rules |
| `tasks/lessons.md` | Corrections and patterns learned |
| `tasks/lessons-pr.md` | PR-specific review patterns |
| `.cursor/rules/*.mdc` | File-pattern-scoped coding rules |
