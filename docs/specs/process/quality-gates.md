# Quality Gates

## Spec Metadata

- ID: PR0004
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-03-12

## Summary

Define the automated quality gates required before changes can land.

## Goals

- Keep formatting consistent across all files.
- Ensure automated checks are repeatable locally and in CI.

## Non-Goals

- Dictate specific formatter choices for every language.

## Requirements

### Must:

- All files are automatically formatted after edits.
- Agents apply formatting as part of their changes.
- Formatting is enforced via pre-commit hooks.
- Pre-commit hook installation/refresh is reproducible from the canonical command surface.
- Formatting is verified in CI via GitHub Actions workflows.
- Formatting uses a 120 character max line width for prose and code where supported.
- Editor configuration points to repo formatter tooling so format-on-save matches CLI behavior.
- Import organization checks run for relevant languages used by the project.
- Repository formatting commands organize TypeScript imports automatically.
- Repository formatting commands apply and verify formatting for `.bicep` and `.bicepparam` files.
- Lint checks enforce environment-boundary rules (for example backend `process.env` access restrictions).
- Migration checks verify schema-update smoke tests pass for the current workflow.
- Migration revision-integrity checks are required once checked-in SQL revision files are adopted.
- Seed checks verify seed command behavior is stable and does not introduce unintended data mutation.
- Dependency-currency checks generate deterministic advisory output for update planning.
- Common developer workflows are invokable through the canonical command surface once command catalog is defined.
- Required CI quality gates run through GitHub Actions before merge and before production deployment.
- CI includes advisory dependency-currency checks once CI workflows are implemented.
- End-to-end smoke tests are required CI checks on pull requests and on `main`.
- Baseline end-to-end CI coverage requires Chromium browser execution.
- Baseline end-to-end CI coverage runs through the containerized Playwright/Chromium path against the isolated
  compose-managed `e2e` stack.
- End-to-end failures publish diagnostic artifacts including screenshot, trace, and browser console logs.

### Should:

- Formatters and linters are configured per language in repo tooling.
- CI and local docs reference canonical command-surface entrypoints.
- Additional e2e browser coverage (for example Firefox/WebKit) should be non-blocking until baseline smoke reliability
  is stable.

### May:

- Add linting and type checks as additional gates.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Implement migration revision-integrity checks in GitHub Actions once checked-in SQL revision integrity rules are
    finalized.
  - Implement seed stability checks in GitHub Actions.
