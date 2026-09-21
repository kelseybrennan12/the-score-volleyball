# Developer Commands

## Spec Metadata

- ID: PR0008
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-09-21

## Summary

Define the single source of truth for common developer-facing commands using `mise`.

## Goals

- Provide one discoverable command entrypoint for humans and agents.
- Keep command behavior identical between a local checkout and GitHub Actions.
- Reduce drift between docs and executable workflows.

## Non-Goals

- Replacing underlying toolchains (`pnpm`, `next`, `vitest`, `gh`) directly from this spec.
- Describing runtime infrastructure. This is a Next.js app deployed to Vercel with checked-in snapshot data; there is no
  database, container runtime, or VM to manage locally.

## Core Concepts

- Canonical entrypoint: `mise run <task>`.
- The command catalog below is the authoritative list. It matches `mise tasks ls`; a task is added to or removed from
  this spec in the same change that adds or removes it from [`/mise.toml`](/mise.toml) or
  [`/mise-tasks/`](/mise-tasks/).
- The catalog covers dependency install, the dev server and build, data pipeline commands, formatting, lint, typecheck,
  tests, CI parity, and GitHub CLI helpers.
- Repeatedly used raw CLI workflows in docs/agent guidance are candidates for promotion into named `mise` tasks.

## Task Authoring Guidance

- Promote commands that appear repeatedly in docs and agent workflows into named `mise run <task>` entries.
- Prefer file tasks under [`/mise-tasks/`](/mise-tasks/) for orchestration-heavy or multi-step workflows.
- Keep `mise.toml` focused on tool/env configuration, simple one-liner tasks, and small aliases where inline TOML
  remains clearer than a separate file.
- Keep reusable wrapper tasks thin: accept args via `usage` or native file-task argv passthrough, then delegate to one
  underlying script/tool invocation.
- Prefer multiple short variant tasks over shell branching within a single task.

## Command Catalog

### Setup

- `mise run deps:install`: install repository Node dependencies from the lockfile. Every task that needs `node_modules`
  depends on this task.
- `mise run hooks-install`: install or refresh the git pre-commit hook via `mise generate git-pre-commit`.
- `mise run gh:auth`: show GitHub CLI authentication status for the managed `gh` tool.

### Run and Build

- `mise run dev`: start the Next.js dev server on `http://localhost:3000`.
- `mise run build`: produce the Next.js production bundle (the same command Vercel runs on deploy).

### Data Pipeline

- `mise run ingest [-- --dry-run] [-- --league <slug>]`: fetch league spreadsheets from Google Sheets and refresh
  [`/data/snapshots/`](/data/snapshots/). Extra args are forwarded to the ingest CLI.
- `mise run archive-season -- --season <session>-<year> [--dry-run]`: freeze each currently-active league belonging to
  the named past season into the frozen `seasons/<session>-<year>/` store and purge that league's live `active/` and
  rollback `archive/` copies from the selected storage backend. `--dry-run` reports the matched leagues and the archive
  counts that would be purged without mutating anything. Target the production Blob store by running with
  `SNAPSHOT_STORAGE=blob` and `BLOB_READ_WRITE_TOKEN` set.
- `mise run report [-- --league <slug>] [-- --team <number>] [-- --format text|md]`: print a per-team schedule report
  from `data/snapshots/active/` for spot-checking parsed data against the league spreadsheets.
- `mise run verify:csvs`: for every `tmp/*.csv` export, infer the league from the weekday in the filename and diff it
  against the matching active snapshot. Exit non-zero if any league has slot or matchup differences (team-order
  differences for played matches are expected and not treated as failures).

### Quality Gates

- `mise run fmt`: apply Prettier formatting (including TypeScript import organization) plus ESLint autofixes.
- `mise run fmt-check`: check formatter-managed files without writing changes. Under the pre-commit hook it checks only
  staged files.
- `mise run lint`: run ESLint over `src/**/*.{ts,tsx}`.
- `mise run typecheck`: run `tsc --noEmit` against the repo `tsconfig.json`.
- `mise run test`: run the Vitest suite under `src/tests/unit/` (and `src/tests/integration/` if it exists).
- `mise run test:e2e`: run Playwright. The task is wired, but no Playwright config or specs exist yet, so it fails until
  an e2e suite lands under `src/tests/e2e/` (see
  [`/docs/specs/process/quality-gates.md`](/docs/specs/process/quality-gates.md)).
- `mise run pre-commit`: run the pre-commit checks (format check, lint, typecheck in parallel) by hand.
- `mise run ci`: run every GitHub Actions gate locally, sequentially and in the same order as
  [`/.github/workflows/ci.yml`](/.github/workflows/ci.yml): `fmt-check`, `lint`, `typecheck`, `test`, `build`.

### Dependencies and GitHub

- `mise run deps:check`: advisory `pnpm outdated --long` report. Exits 0 whether or not updates exist; only a genuine
  `pnpm` error fails it.
- `mise run gh:runs`: list the most recent GitHub Actions runs for this repository.
- `mise run gh:logs <run-id> [gh run view args]`: print the log for a GitHub Actions run, with optional pass-through
  flags (for example `--job <job-id>`).

## Requirements

### Must:

- Project docs treat `mise` as the canonical command surface for developer and agent workflows.
- The command catalog in this spec matches the output of `mise tasks ls`. Docs never reference a task name that is not
  in the catalog.
- Reusable commands referenced repeatedly in docs or agent guidance are promoted to named `mise` tasks.
- Multi-step workflows live in file tasks under [`/mise-tasks/`](/mise-tasks/) (currently `pre-commit` and `ci`) rather
  than large inline `run = '''...'''` blocks in [`/mise.toml`](/mise.toml).
- Tasks that require repository `node_modules` depend on one canonical install task, `deps:install`, rather than relying
  on workflow-local `pnpm install` steps.
- `dev` is the canonical local runtime start command. There are no separate lifecycle, teardown, log, or VM commands
  because the app has no local services beyond the Next.js dev server.
- Data pipeline tasks (`ingest`, `archive-season`, `report`, `verify:csvs`) operate on the checked-in snapshots under
  [`/data/snapshots/`](/data/snapshots/) and forward CLI args through `usage` passthrough after `--`.
- Runtime configuration comes from a project `.env` file documented by [`/.env.example`](/.env.example). Secrets are
  never committed.
- `fmt` applies repository-supported formatting for source and prose assets plus lint autofixes.
- `fmt-check` remains non-mutating for formatter-managed file types with dedicated check behavior.
- `ci` runs the same gates as the GitHub Actions workflow, in the same order, and sequentially. `next build` rewrites
  `.next/types` while `tsc` reads them, so typecheck and build must never run concurrently.
- `deps:check` is advisory and does not fail solely because dependencies are behind latest versions.
- GitHub CLI workflows (`gh:auth`, `gh:runs`, `gh:logs`) run through canonical `mise` tasks backed by `gh` in the
  managed toolchain.
- Wrapper tasks stay thin and delegate to underlying scripts/tools. When a workflow needs complex shell logic, it moves
  into a dedicated file task or repo script instead of growing inline TOML.
- New reusable wrapper tasks use `usage` arg passthrough and delegate to the underlying CLI tool rather than embedding
  complex shell logic.
- When a frequently used command needs a single argument that may contain spaces, the canonical command surface exposes
  a dedicated named task for that argument rather than relying on fragile shell-quoting passthrough.
- Docs do not invent unsupported command names.
- Developer-facing docs reference canonical command surface guidance rather than duplicating ad hoc command chains.

### Should:

- Command names are concise and action-oriented.
- Command outputs clearly state delegated commands for debugging.
- If low-level command examples are documented, include the canonical command-surface equivalent first.
- For new wrapper tasks, keep run blocks concise and split variants into separate tasks when it improves readability.

### May:

- Split command definitions across multiple files if the catalog grows.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - `test:e2e` has no Playwright config or specs behind it. It becomes a working command when the e2e suite tracked in
    [`/docs/specs/process/quality-gates.md`](/docs/specs/process/quality-gates.md) lands.
