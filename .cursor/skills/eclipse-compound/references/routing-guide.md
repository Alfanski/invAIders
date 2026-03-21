# Correction Routing Guide

Determines which file(s) to update when a correction is made. Read this when
the routing decision in the main SKILL.md isn't clear enough.

## Decision Tree

```
What kind of correction was it?
│
├── Project command or setup step changed
│   └── Primary: root CLAUDE.md
│       Secondary: root AGENTS.md
│
├── Architecture or layer rule changed
│   └── Primary: root CLAUDE.md
│       Secondary: relevant subdirectory AGENTS.md / CLAUDE.md
│
├── File-specific coding pattern
│   └── Cursor: .cursor/rules/*.mdc (with appropriate glob)
│       Claude Code: subdirectory CLAUDE.md (nearest to affected files)
│
├── Module-specific pattern
│   └── Subdirectory AGENTS.md / CLAUDE.md for that module
│
├── PR quality gate or review standard
│   └── tasks/lessons-pr.md
│
├── Cross-tool instruction (applies to all agents)
│   └── Root AGENTS.md
│
├── Anti-pattern to avoid
│   └── Primary: root CLAUDE.md anti-patterns section
│       Secondary: relevant coding rules
│
└── Data contract or payload change
    └── Primary: data contract doc
        Secondary: coding rules for affected files
```

## File Size Budgets

| File | Target | Max | Action if Over |
|------|--------|-----|---------------|
| Root CLAUDE.md | 60-80 | 100 | Extract to .cursor/rules/ or subdirectory docs |
| Root AGENTS.md | 80-100 | 120 | Extract to subdirectory AGENTS.md |
| .cursor/rules/*.mdc | 50-100 | 150 | Split into multiple rules with narrower globs |
| Subdirectory docs | 30-80 | 100 | Split into sub-subdirectory docs |

## Promotion Criteria

A lesson should be promoted from `tasks/lessons.md` to a permanent doc when:

1. The same pattern appears 2+ times
2. Multiple developers have hit the same issue
3. The lesson applies to all future work in that area (not a one-off)

Promotion target depends on scope:
- Affects entire repo → root CLAUDE.md or AGENTS.md
- Affects specific files → .cursor/rules/*.mdc
- Affects PR reviews → tasks/lessons-pr.md
