# End-to-End Tests

## Purpose

Small, high-value happy-path flows across deployed app boundaries.

## Allowed File Kinds

- End-to-end scenario tests covering critical user journeys.
- E2E-specific harness/config files.
- Playwright fixtures and helpers aligned to smoke-flow execution.

## Rules

- Use Playwright as the canonical e2e framework.
- Run against an isolated compose-managed local `e2e` stack by default.
- Use `e2e:smoke:headless` for the one-shot host smoke path, `e2e:smoke:headed` for one-shot local headed runs,
  `e2e:smoke:container` for the CI-equivalent path, and `e2e:stack:up` plus `e2e:run:*` for iterative local debugging.
- Keep suite intentionally small for speed (3-5 critical smoke flows).
- Chromium coverage is required baseline browser coverage.
- Support both host-run and container-run execution against the same stack contract.
- The `e2e` stack uses the dedicated shared test Postgres rather than the `dev` / `built` runtime database.
- Each disposable e2e app schema clones from the shared test database `public` template schema.
- Each smoke owns a disposable app schema and scenario-owned data.
- The first wave is 4 medium smoke journeys, with one journey per spec file.
- On failure, collect screenshot, trace, and browser console logs.

## Disallowed Patterns

- Large exhaustive scenario matrices in e2e.
- Re-testing branch-level core logic already covered by unit tests.
- Assertions that require exclusive global system ownership (for example brittle global-count expectations).
- Treating optional Firefox/WebKit runs as baseline blocking requirements.

## Notes for Future Files

- Add new e2e coverage only when the scenario is business-critical and not already protected by faster test kinds.
- Additional browser coverage can be added later as non-blocking or staged checks.
