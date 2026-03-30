# Integration Tests

## Purpose

Validate behavior across module boundaries, especially services/repos/database interactions.

## Allowed File Kinds

- Service + repo + persistence integration specs.
- Harness utilities for containerized dependency setup.

## Rules

- Focus on happy-path correctness for real boundary interactions.
- Use canonical repo interfaces and transaction boundaries as exercised in runtime.

## Disallowed Patterns

- Replacing all dependencies with mocks and calling the test integration.
- Broad end-to-end UI flows.

## Notes for Future Files

- Keep setup deterministic and keep runtime as fast as practical.
