---
name: eclipse-test
description: >-
  Dedicated test authoring workflow: analyze coverage gaps, design test strategy,
  write focused tests with good assertions, and verify they catch real bugs.
  Loads repo-specific knowledge from AGENTS.md for test conventions and patterns.
  Use when writing tests, improving coverage, or when the user says "write tests",
  "add test coverage", "test this", or "improve tests".
---

# Eclipse Test

Write tests that catch real bugs, not tests that merely exist.

## Operating Principles

1. **Test behavior, not implementation** -- tests should survive refactoring
2. **One assertion per concept** -- each test verifies one specific behavior
3. **Arrange-Act-Assert** -- every test follows this structure
4. **Edge cases first** -- boundaries and error paths catch more bugs than happy paths
5. **Fast and isolated** -- no external dependencies without mocking
6. **Readable as documentation** -- test names describe the scenario and expected outcome

---

## Phase 0: Load Project Context

Before writing tests, understand project test conventions:

1. **`CLAUDE.md`** and **`AGENTS.md`** -- test commands, framework, naming conventions
2. **`tasks/lessons.md`** -- testing patterns and gotchas specific to this repo
3. **Coding rules** for test files:
   - Cursor: `.cursor/rules/*.mdc` (glob-scoped, may have test-specific rules)
   - Claude Code: subdirectory `CLAUDE.md` in `tests/`
4. **Existing tests** -- read 2-3 existing test files to understand patterns:
   - Naming: `test_*.py`, `*.test.ts`, `*.spec.ts`, etc.
   - Fixtures: shared test setup, factories, builders
   - Mocking: how external dependencies are mocked

**Context budget**: Keep under ~2,000 tokens. Focus on test conventions.

---

## Phase 1: Coverage Analysis

### 1.1 Identify What to Test

If the user specifies a target, use that. Otherwise, identify gaps:

```bash
# Check existing coverage (if coverage tool is configured)
[coverage command from CLAUDE.md]

# List functions/classes without tests
# Compare source files to test files
ls [source-dir]/*.py
ls tests/[test-dir]/test_*.py
```

### 1.2 Classify Test Needs

For each function/class to test:

| Function | Has Tests | Coverage | Priority |
|----------|-----------|----------|----------|
| `func_a` | Yes | Happy path only | Add edge cases |
| `func_b` | No | None | Write from scratch |
| `func_c` | Yes | Comprehensive | Skip |

### 1.3 Design Test Strategy

```markdown
## Test Strategy for [target]

### Unit Tests (isolated, fast)
- [ ] [Scenario]: [Expected behavior]
- [ ] [Scenario]: [Expected behavior]

### Edge Cases
- [ ] Empty input
- [ ] None/null/undefined
- [ ] Boundary values (0, -1, MAX_INT)
- [ ] Invalid types
- [ ] Concurrent access (if applicable)

### Error Paths
- [ ] [Error scenario]: [Expected exception/response]
- [ ] [Error scenario]: [Expected exception/response]

### Integration Tests (if needed)
- [ ] [End-to-end scenario]
```

**Present the test strategy for confirmation before writing tests.**

---

## Phase 2: Write Tests

### 2.1 Test Structure

Follow the project's existing patterns. For detailed templates covering Python
(pytest) and TypeScript (jest/vitest), read `references/test-patterns.md`.

Key principles:
- Arrange-Act-Assert structure in every test
- One assertion per concept
- Use the project's existing fixtures and factories
- Follow the project's naming convention from `AGENTS.md`

### 2.3 Mocking Rules

- Mock external services (HTTP, DB, queues) -- never call real services
- Mock at the boundary, not deep internals
- Use the project's mocking patterns (check existing tests)
- Assert mocks were called with expected arguments

### 2.4 Quality Checks

For each test, verify:
- [ ] Test name describes the scenario (readable without reading the code)
- [ ] Arrange-Act-Assert structure is clear
- [ ] Only one concept tested per test function
- [ ] Assertions are specific (not just "not None" or "truthy")
- [ ] Error messages in assertions help diagnose failures
- [ ] No hardcoded sleep or timing dependencies

---

## Phase 3: Verify

### 3.1 Run New Tests

```bash
# Run only the new tests first
[test command] [new-test-file]
```

All new tests must pass.

### 3.2 Run Full Suite

```bash
# Ensure no existing tests broken
[test command]
```

### 3.3 Mutation Check (manual)

For critical tests, verify they actually catch bugs:

1. Temporarily break the code the test covers (change a condition, remove a line)
2. Run the test -- it should fail
3. Revert the breakage

If the test passes with broken code, the assertion is too weak.

### 3.4 Run Lint

```bash
[lint command]
```

---

## Phase 4: Documentation

- [ ] If test patterns were established --> add to `tasks/lessons.md`
- [ ] If test conventions differ from docs --> update `AGENTS.md` or coding rules
- [ ] If a bug was discovered while testing --> file a separate issue or fix it

---

## Bundled Resources

- **`references/test-patterns.md`** -- Detailed test templates for Python (pytest)
  and TypeScript (jest/vitest). Includes fixtures, parametrize, mocking, async
  patterns, and naming conventions. Read when writing tests to follow established
  patterns.

## Constraints

- Never write tests that depend on execution order
- Never use real external services (APIs, databases) in unit tests
- Never test private/internal implementation details -- test public behavior
- Never write tests just for coverage numbers -- every test should catch a real class of bugs
- If code is untestable, refactor it first (extract dependencies, use injection)
