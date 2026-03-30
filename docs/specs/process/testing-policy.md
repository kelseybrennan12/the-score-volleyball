# Testing Policy

## Spec Metadata

- ID: PR0011
- Type: Process
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define when and how to write unit, integration, and e2e tests so agents can add coverage without duplicating it or
producing false confidence.

## Goals

- Standardize layer boundaries so each test type has clear ownership.
- Prevent duplicated coverage across layers.
- Prevent false-positive tests that pass despite real regressions.
- Keep mocks limited to true architectural boundaries.

## Non-Goals

- Defining CI pipeline configuration.
- Prescribing one test framework or assertion library.

## Requirements

### Must:

#### Layer Boundaries

| Layer                                  | Scope                                                                             | Dependencies                                           | When Required                            |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Unit (`src/tests/unit/`)               | Pure functions in `/core/` and other side-effect-free helpers                     | No repos, services, or database mocks                  | Every new pure decision/helper function  |
| Integration (`src/tests/integration/`) | API endpoints, service orchestration, worker handlers, repository-backed behavior | Real Postgres with isolated schema/runtime; real repos | Every new API endpoint or service method |
| E2e (`src/tests/e2e/`)                 | Critical user workflows through the browser                                       | Full stack: browser, API, DB, jobs                     | Every new user-facing workflow           |

#### Rules For AI-Generated Tests

1. Test behavior, not implementation details.
2. Keep one concept per test.
3. Make test names describe the reason a failure matters.
4. Avoid unsafe type coercion in tests.
5. Do not use snapshot tests for logic or API behavior.
6. Do not duplicate an assertion at a higher layer if a lower layer already catches the same regression.
7. E2e tests must verify persistence by reloading or revisiting after every mutation.
8. Only mock true architectural boundaries such as external HTTP APIs, clock, randomness, or enqueue-only queue edges.
9. Do not mock repos, services, or the database.
10. Cover the happy path, boundary cases, and the primary error path.

#### CRUD Integrity Checks

- After a create, assert the total record count increased by exactly one.
- After an edit, assert the total record count did not change.
- After an edit, assert the original value is no longer present.
- After a delete, assert the specific deleted item is gone by a unique identifier.
- After every mutation in e2e, reload and re-assert persisted state.

#### Mock Boundaries

Mock these:

- external HTTP APIs
- system clock when deterministic timestamps are needed
- randomness when deterministic IDs are needed
- queue enqueue boundaries in integration tests when execution is out of scope

Never mock these:

- repositories
- services
- the database
- core decision functions

#### File Conventions

- Unit tests: `src/tests/unit/backend/core/<module>.test.ts`
- API integration tests: `src/tests/integration/backend/api/<scenario>.test.ts`
- Worker integration tests: `src/tests/integration/backend/jobs/<scenario>.test.ts`
- Frontend unit tests: `src/tests/unit/frontend/<module>.test.ts`
- E2e tests: `src/tests/e2e/<workflow>.smoke.spec.ts`

### Should:

- Prefer factories or helpers over repetitive inline fixtures.
- Keep e2e suites smoke-sized and focused on the most important workflows.
- When async work settles after request completion, wait for the visible success state before reloading in e2e.

### May:

- Add specialized testing helpers when they remove duplication without hiding important setup intent.

## Open Questions

- None.
