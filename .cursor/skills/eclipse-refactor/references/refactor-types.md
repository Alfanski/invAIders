# Refactoring Patterns Reference

Common refactoring operations with steps and risks. Read this when planning
a refactoring to select the right approach.

## Extract Function / Method

**When**: A function is too long or a code block is reused.

**Steps**:
1. Identify the code block to extract
2. Determine inputs (parameters) and outputs (return value)
3. Create the new function with a descriptive name
4. Replace the original code with a call to the new function
5. Update tests to cover the new function directly

**Risk**: Low. Behavior is preserved if inputs/outputs are correct.

## Extract Class / Module

**When**: A class has too many responsibilities or a file is too large.

**Steps**:
1. Identify the cohesive subset of methods and state
2. Create a new class/module with those members
3. Update the original class to delegate to the new one
4. Update all import/reference sites
5. Move related tests

**Risk**: Medium. Import changes can be widespread.

## Rename

**When**: A name doesn't accurately describe the thing.

**Steps**:
1. Search for ALL references (imports, string references, config, tests, docs)
2. Rename in all locations atomically
3. Check for dynamic references (string-based lookups, reflection, serialization)

**Risk**: Low-Medium. Dynamic references are the main trap.

## Move (Relocate)

**When**: A function/class is in the wrong module.

**Steps**:
1. Create the new location
2. Move the code
3. Add a re-export at the old location (temporary, for backward compatibility)
4. Update all import sites to use the new location
5. Remove the re-export after all callers are updated

**Risk**: Medium. Cross-module imports can surprise you.

## Simplify (Reduce Complexity)

**When**: Cyclomatic complexity is high, deep nesting, long conditionals.

**Patterns**:
- Replace nested `if/else` with guard clauses (early returns)
- Replace switch/case with lookup table or polymorphism
- Replace flag arguments with separate functions
- Flatten callback pyramids with async/await

**Risk**: Low if tests cover the paths.

## Dedup (Remove Duplication)

**When**: The same logic appears in 2+ places.

**Steps**:
1. Confirm the duplicates are truly identical (not just similar)
2. Extract the shared logic into a function
3. Replace all duplicates with calls to the shared function
4. If the duplicates differ slightly, parameterize the shared function

**Risk**: Medium. "Similar but not identical" duplication is a trap --
abstracting too early creates the wrong abstraction.

## Restructure (Change Module Boundaries)

**When**: The module/package structure doesn't match the domain.

**Steps**:
1. Map the desired structure (new directories, modules)
2. Move files one at a time, updating imports after each move
3. Test after each file move
4. Update documentation (AGENTS.md, subdirectory docs)

**Risk**: High. Touches many files. Do incrementally over multiple PRs if large.
