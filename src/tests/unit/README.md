# Unit Tests

## Purpose

Validate pure logic behavior at function/module granularity.

## Allowed File Kinds

- Tests for `src/backend/logic/core` and other pure utilities.
- Deterministic fixtures for branch and edge-case coverage.

## Rules

- No network/DB/process side effects.
- Prioritize branch coverage for core decision logic.

## Disallowed Patterns

- Using real infrastructure adapters.
- Slow end-to-end style flows.

## Notes for Future Files

- Keep tests small and explicit about input/output values.
