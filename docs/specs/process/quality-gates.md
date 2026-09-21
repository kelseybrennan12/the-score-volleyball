# Quality Gates

## Spec Metadata

- ID: PR0004
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-09-21

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
- Lint checks run ESLint over all TypeScript source via the canonical command surface (`mise run lint`).
  Project-specific rules live in [`/eslint.config.mjs`](/eslint.config.mjs); today that is import-block spacing only.
  There is no environment-boundary rule: `process.env` is read directly where needed.
- Dependency-currency checks are advisory: `mise run deps:check` reports outdated packages via `pnpm outdated` and never
  blocks a commit.
- Common developer workflows are invokable through the canonical command surface defined in
  [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md).
- Required CI quality gates run through GitHub Actions on pull requests targeting `main` and on pushes to `main`
  ([`.github/workflows/ci.yml`](/.github/workflows/ci.yml)).
- The CI gate set is: formatting check, lint, typecheck, unit tests, and production build, each invoked through the
  canonical `mise` task surface so local and CI behavior cannot drift.
- The full CI gate set is runnable locally with `mise run ci`.
- CI does not run dependency-currency checks; `deps:check` is a local advisory task.
- End-to-end browser smoke tests become a required CI check once an e2e suite exists under `src/tests/e2e/`; until then
  CI does not run Playwright.

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
  - Add a Playwright e2e suite under `src/tests/e2e/` and promote it to a required CI check. Playwright is installed and
    `mise run test:e2e` is wired, but there is no config or spec yet.
