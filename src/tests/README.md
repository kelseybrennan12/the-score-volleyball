# Tests

## Purpose

Canonical test tree organized by test kind for speed and confidence.

## Allowed File Kinds

- Test files grouped by kind (`unit`, `integration`, `contract`, `e2e`).
- Shared test helpers and fixtures that remain boundary-safe.

## Rules

- Keep fast feedback as default while preserving critical coverage.
- Unit tests prioritize high branch coverage for pure `core` logic.
- Integration and e2e suites prioritize happy-path confidence and runtime correctness.
- E2E coverage is a small smoke suite (3-5 critical flows) and remains intentionally constrained for runtime speed.
- Integration and e2e suites both target a dedicated shared test database rather than the `dev` / `built` runtime
  database.
- Integration and e2e disposable schemas clone from the shared test database `public` template schema.
- E2E tests run against an isolated compose-managed `e2e` stack, use disposable per-test schemas, and own their own
  scenario data.

## Disallowed Patterns

- Mixing test kinds in the wrong folder without clear rationale.
- Putting production domain logic inside test helpers.

## Notes for Future Files

- Add per-kind helper modules under each test kind when needed.
