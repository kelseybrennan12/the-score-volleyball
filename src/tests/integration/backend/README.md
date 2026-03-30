# Backend Integration Scenarios

This folder is the reserved home for DB-backed backend integration coverage.

## Purpose

- Exercise boundary behavior that is more realistic than unit tests but still faster and smaller than end-to-end UI
  coverage.
- Keep the integration layer aligned with the repo architecture when a starter project needs real repo/service/database
  wiring checks.

## Current Baseline

- The old scenario harnesses were removed during the starter reset.
- Add new integration coverage here only when a feature needs a real persistence/runtime check that unit tests do not
  already cover.

## Rules

- Keep integration tests focused on one boundary or workflow at a time.
- Prefer neutral starter concepts and reusable repository/service seams over product-specific fixtures.
- Add helper modules only when a test suite needs them.

## Notes for Future Files

- Use small, explicit scenario fixtures.
- Favor happy-path coverage unless a regression needs a specific edge case.
