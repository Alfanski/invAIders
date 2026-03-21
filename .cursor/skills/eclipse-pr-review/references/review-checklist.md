# PR Review Checklist Reference

Extended checklist loaded on demand during reviews. The main SKILL.md contains
the abbreviated version; read this file when reviewing complex PRs or when the
abbreviated checklist isn't specific enough.

## Functional Correctness (highest priority)

- Requirements from linked issue are fulfilled
- Data flow is correct end-to-end through changed paths
- Logic is sound: no off-by-one, wrong operators, unreachable code
- Edge cases handled: empty inputs, None, missing keys, boundary values
- Integration points correct: function signatures, return types, contracts
- Race conditions: shared state accessed safely in concurrent contexts
- Idempotency: repeated calls produce the same result where expected

## Architecture

- Layer/module boundaries respected (check project docs for rules)
- No circular imports introduced
- New dependencies justified and version-pinned
- No god objects or excessive coupling introduced
- Dependency direction follows the dependency rule (inner layers don't depend on outer)

## Code Quality

- Functions are focused and appropriately sized (< 50 lines as a guideline)
- Error handling is comprehensive (no bare except, chains with `from e`)
- Type hints on all public functions (Python) / TypeScript types on exports
- Logging uses structured format, never f-strings
- No hardcoded secrets or credentials
- Magic numbers extracted to named constants
- DRY: no copy-paste code that should be abstracted

## Testing

- Tests cover new/changed code paths
- Test naming follows project conventions
- Edge cases and error paths tested
- No test relies on external services without mocking
- Tests are deterministic (no flaky timing or ordering dependencies)
- Assertions are specific, not just "not None" or truthy checks

## Security

- No SQL injection via string interpolation
- No `eval()`, `exec()`, or `os.system()` with user input
- Sensitive data not logged (tokens, passwords, PII)
- Input validation on new endpoints or public methods
- CORS, CSP, and auth headers configured correctly for new endpoints
- Dependencies checked against known vulnerability databases

## Performance

- No N+1 query patterns introduced
- Large collections are paginated or streamed
- Expensive operations are cached or batched where appropriate
- No unbounded loops or recursive calls without depth limits

## Documentation

- `CLAUDE.md` / `AGENTS.md` updated if architecture/commands/patterns changed
- Coding rules updated if file-specific patterns changed
- Subdirectory docs updated if module patterns changed
- `tasks/lessons.md` updated if a correction drove this change
- PR description includes "Documentation Updates" section
