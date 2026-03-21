---
name: eclipse-research
description: >-
  Explore and understand a codebase systematically. Maps architecture, traces
  data flows, identifies patterns, and answers "how does X work?" questions.
  Loads repo-specific knowledge from AGENTS.md to build on existing documentation.
  Use when exploring unfamiliar code, understanding architecture, tracing data
  flows, or when the user says "how does this work", "explain the architecture",
  "trace the flow", or "explore the codebase".
---

# Eclipse Research

Systematic codebase exploration. Understand before you change.

## Operating Principles

1. **Top-down then bottom-up** -- start with architecture, drill into details
2. **Follow the data** -- trace how data flows through the system
3. **Document as you go** -- findings are only useful if captured
4. **Question assumptions** -- verify what docs say against what code does
5. **Scope aggressively** -- answer the specific question, don't map the entire codebase

---

## Phase 0: Load Existing Context

Before exploring, read what's already documented:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- architecture overview, commands, structure
2. **`tasks/lessons.md`** -- known patterns and gotchas
3. **Subdirectory docs** -- `AGENTS.md` / `CLAUDE.md` in relevant modules
4. **README.md** -- project overview

This prevents re-discovering what's already known.

**Context budget**: Read root docs fully. Skip rules files -- research doesn't
need coding standards, it needs architectural context.

---

## Phase 1: Scope the Question

### 1.1 Clarify What to Explore

Ask the user or determine from context:

- **What**: What specific question needs answering?
- **Depth**: Overview or deep-dive?
- **Output**: Mental model, written doc, or diagram?

### 1.2 Classify the Investigation

| Type | Example | Approach |
|------|---------|----------|
| **Architecture** | "How is the project structured?" | Top-down: tree, entry points, layers |
| **Data flow** | "How does a request get processed?" | Trace: entry point -> handler -> storage |
| **Dependency** | "What depends on this module?" | Fan-out: grep for imports/references |
| **Pattern** | "How do we handle auth here?" | Sample: find 3+ examples, extract pattern |
| **Integration** | "How does service A talk to B?" | Boundary: find API calls, contracts, queues |

---

## Phase 2: Explore

### 2.1 Map the Structure

```bash
# Directory tree (top 3 levels, excluding noise)
find . -type d -maxdepth 3 \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/__pycache__/*" \
  -not -path "*/.venv/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" | sort

# Entry points
ls -la *.py *.ts *.js 2>/dev/null
cat package.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('Scripts:', json.dumps(d.get('scripts',{}), indent=2))" 2>/dev/null
```

### 2.2 Trace Data Flows

For "how does X work?" questions:

1. **Find the entry point**: HTTP handler, CLI command, event listener, scheduler
2. **Follow the call chain**: Read each function in sequence
3. **Note transformations**: Where is data validated, enriched, filtered, stored?
4. **Identify boundaries**: Where does the flow cross module/service/system boundaries?

```bash
# Find entry point
grep -rn "def [handler_name]\|router\|@app.route\|@controller" [src-dir]

# Follow imports
grep -rn "from [module] import\|require.*[module]" [src-dir]
```

### 2.3 Dependency Mapping

For "what depends on X?" questions:

```bash
# Direct dependents (who imports this)
grep -rn "from [module] import\|import [module]" --include="*.py" --include="*.ts"

# Reverse: what does this module depend on?
head -30 [target-file]  # Read imports
```

### 2.4 Pattern Extraction

For "how do we do X here?" questions:

1. Find 3+ examples of the pattern in the codebase
2. Identify what's consistent (the pattern) vs. what varies
3. Extract the template

---

## Phase 3: Synthesize

### 3.1 Present Findings

Structure depends on the investigation type:

**Architecture overview**:
```markdown
## Architecture: [Repo Name]

### Layers
1. **[Layer]** -- [purpose, key files]
2. **[Layer]** -- [purpose, key files]

### Key Patterns
- [Pattern]: [how and where it's used]

### Data Flow
[Entry] -> [Processing] -> [Storage] -> [Response]

### Key Files
| File | Purpose |
|------|---------|
| [path] | [role in the system] |
```

**Data flow trace**:
```markdown
## Flow: [Scenario]

1. **[Entry point]** (`path/file.py:line`)
   - Receives: [input shape]
   - Validates: [what's checked]

2. **[Service layer]** (`path/service.py:line`)
   - Transforms: [what changes]
   - Calls: [downstream dependencies]

3. **[Storage]** (`path/repo.py:line`)
   - Persists: [what and where]
   - Returns: [output shape]
```

**Dependency map**:
```markdown
## Dependencies: [Module]

### Depends On (imports from)
- [module] -- [what it uses]

### Depended On By (imported by)
- [module] -- [what it uses from here]

### External
- [service/API] -- [how it's called]
```

---

## Phase 4: Document (optional)

If the research revealed undocumented architecture or patterns, offer to
update the relevant docs:

- [ ] New architectural insight --> update `AGENTS.md` or subdirectory docs
- [ ] New pattern discovered --> add to coding rules or `AGENTS.md`
- [ ] Stale documentation found --> update or flag for audit
- [ ] Gotcha discovered --> add to `tasks/lessons.md`

Only update docs if the user confirms. Research is read-only by default.

---

## Constraints

- Do not modify code during research (read-only unless user explicitly asks)
- Do not read entire large files -- use targeted searches and read specific sections
- If the codebase contradicts the documentation, note the discrepancy explicitly
- Keep findings scoped to the original question -- don't map the entire codebase
- Present findings at the right level of detail for the user's question
