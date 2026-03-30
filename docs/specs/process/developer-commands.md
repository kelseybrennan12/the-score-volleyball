# Developer Commands

## Spec Metadata

- ID: PR0008
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-04-06

## Summary

Define the single source of truth for common developer-facing commands using `mise`.

## Goals

- Provide one discoverable command entrypoint for humans and agents.
- Keep command workflows consistent across local and containerized development modes.
- Reduce drift between docs and executable workflows.

## Non-Goals

- Defining every concrete command in this initial planning stage.
- Replacing underlying toolchains directly from this spec.

## Core Concepts

- Canonical entrypoint intent: `mise`.
- Command catalog status: **Defined for the current runtime, test, and CI workflows**.
- The command catalog covers setup, formatting, runtime lifecycle, testing, dependency visibility, build, and CI
  workflows.
- Underlying tools may include language runtimes and container orchestration CLIs.
- Repeatedly used raw CLI workflows in docs/agent guidance are candidates for promotion into named `mise` tasks.

## Task Authoring Guidance

- Promote commands that appear repeatedly in docs and agent workflows into named `mise run <task>` entries.
- Prefer file tasks under [`/mise-tasks/`](/mise-tasks/) for orchestration-heavy or multi-step workflows.
- Keep `mise.toml` focused on tool/env configuration, simple one-liner tasks, and small aliases where inline TOML
  remains clearer than a separate file.
- Keep reusable wrapper tasks thin: accept args via `usage` or native file-task argv passthrough, then delegate to one
  underlying script/tool invocation.
- Prefer multiple short variant tasks over shell branching within a single task.

## Initial Command Catalog

- `mise run setup`: install local toolchain dependencies and hooks for this repository.
- `mise run dev:up`: explicit local runtime bring-up command.
- `mise run dev:down`: hard-stop local runtime services while preserving named volumes.
- `mise run dev:down-reset`: hard-stop local runtime services and remove named volumes/state.
- `mise run built:up`: explicit local prod-like built runtime bring-up command.
- `mise run built:down`: hard-stop local built runtime services while preserving named volumes.
- `mise run built:logs`: show recent logs for the prod-like built local services.
- `mise run vm:gh:ensure`: ensure the worktree-scoped GitHub-like Lima VM exists, matches the current folder mount, and
  is running on macOS.
- `mise run vm:gh:shell`: open a shell in the GitHub-like Lima VM.
- `mise run dev:db:bootstrap`: run the local database bootstrap service directly.
- `mise run dev:logs`: show recent logs for core local services.
- `mise run dev:logs:follow`: follow logs for core local services.
- `mise run dev:logs:all`: show recent logs for all local compose services.
- `mise run dev:logs:<service>`: show recent logs for a specific service.
- `mise run dev:logs:app-edge`: show recent logs for the local app-edge service.
- `mise run dev:logs:app-api`: show recent logs for the local app-api service.
- `mise run dev:logs:idp`: show recent logs for the local OIDC simulator service.
- `mise run fmt`: apply repository formatting.
- `mise run fmt` applies Prettier formatting plus lint autofixes in one command.
- `mise run fmt-check`: check formatter-managed files without writing changes.
- `mise run env:sync`: sync `.env` keys and ordering from `.env.example`.
- `mise run deps:install`: install repository Node dependencies from the lockfile for tasks that require `node_modules`.
- `mise run deps:check`: run advisory dependency-currency checks and summary output.
- `mise run pre-commit`: run pre-commit checks manually.
- `mise run hooks-install`: install or refresh the git pre-commit hook via `mise`.
- `mise run test`: execute default automated test suite.
- `mise run test:unit`: execute the default automated unit/contract suite.
- `mise run test:integration`: execute integration tests through the canonical task surface.
- `mise run test:e2e`: execute Chromium smoke flows through the canonical task surface.
- `mise run test-integration`: execute integration tests against containerized dependencies.
- `mise run test:db:prepare`: prepare the dedicated shared test database template schema for integration/e2e cloning.
- `mise run e2e:stack:up`: start the isolated compose-managed e2e stack for iterative local browser work.
- `mise run e2e:stack:down`: tear down the isolated compose-managed e2e stack and clear its persisted host runtime
  state.
- `mise run e2e:run:headless [playwright args]`: run host Playwright headlessly against the isolated e2e stack and leave
  it running.
- `mise run e2e:run:headless:grep <pattern>`: run host Playwright headlessly against the isolated e2e stack, targeting
  tests by title regex without relying on shell-quoting passthrough.
- `mise run e2e:run:headed [playwright args]`: run host Playwright in headed mode against the isolated e2e stack and
  leave it running.
- `mise run e2e:run:headed:grep <pattern>`: run host Playwright in headed mode against the isolated e2e stack, targeting
  tests by title regex.
- `mise run e2e:run:ui [playwright args]`: open Playwright UI against the isolated e2e stack and leave it running.
- `mise run e2e:smoke:headless`: execute one-shot host Playwright smoke flows headlessly against the isolated
  compose-managed `e2e` stack with Chromium as the required browser baseline.
- `mise run e2e:smoke:headless:grep <pattern>`: execute one-shot host Playwright headlessly against the isolated
  compose-managed `e2e` stack, targeting tests by title regex.
- `mise run e2e:smoke:headed`: execute one-shot host Playwright smoke flows in headed mode against the isolated
  compose-managed `e2e` stack.
- `mise run e2e:smoke:container`: execute the same Playwright smoke flows inside the dedicated Playwright container
  against the isolated compose-managed `e2e` stack.
- `mise run ci:check`: run the non-test CI check graph for formatting, dependency advisory checks, lint, and build
  sanity.
- `mise run build`: produce deployable build artifacts and container build context.
- `mise run gh:auth`: verify local GitHub CLI auth context used for repository workflows.
- `mise run gh:runs`: list recent GitHub Actions runs for this repository.
- `mise run gh:logs <run-id> [gh run view args]`: fetch logs for a specific GitHub Actions run with optional
  pass-through flags (for example `--job <job-id>`).
- `mise run gh:job-logs <run-id> <job-id>`: fetch logs for a specific job in a run.
- `mise run azure:containerapp:env <app-name> <resource-group>`: show deployed Container App env entries
  (`name`/`value`/`secretRef`).
- `mise run azure:entra:app-show <app-id>`: show Entra app registration JSON for a client id.
- `mise run azure:entra:sp-show <app-id>`: show Entra service principal JSON for a client id.
- `mise run azure:entra:app-credentials <app-id>`: list Entra app credentials for a client id.
- `mise run azure:entra:graph-role-assignments <app-id>`: list Microsoft Graph app-role assignments for the app service
  principal.
- `mise run ci`: run local CI-equivalent checks in canonical order.

## Requirements

### Must:

- Project docs treat `mise` as the canonical command surface for developer and agent workflows.
- A concrete command catalog is defined before implementation relies on command names in docs.
- Reusable commands referenced repeatedly in docs or agent guidance are promoted to named `mise` tasks.
- Complex reusable command workflows live in file tasks under [`/mise-tasks/`](/mise-tasks/) rather than large inline
  `run = '''...'''` blocks in [`/mise.toml`](/mise.toml).
- Command names for runtime, database, test, dependency, build, and CI workflows are:
  - `dev:up`
  - `built:up`
  - `dev:down`
  - `dev:down-reset`
  - `dev:logs`
  - `vm:gh:ensure`
  - `vm:gh:shell`
  - `test`
  - `test:unit`
  - `test:integration`
  - `test:e2e`
  - `test-integration`
  - `e2e:stack:up`
  - `e2e:stack:down`
  - `e2e:run:headless`
  - `e2e:run:headed`
  - `e2e:run:ui`
  - `e2e:smoke:headless`
  - `e2e:smoke:headed`
  - `e2e:smoke:container`
  - `ci:check`
  - `deps:install`
  - `deps:check`
  - `env:sync`
  - `build`
  - `ci`
- `dev:up` remains the canonical local runtime start command.
- `built:up` is the canonical local prod-like built-runtime start command.
- Explicit lifecycle commands use `dev:*` naming.
- Repo-owned local VM lifecycle commands use `vm:*` naming.
- Runtime log-access commands use `dev:logs*` naming.
- Local runtime lifecycle behavior is standardized:
  - `dev:up`: single compose bring-up command for the `dev` profile; startup init ordering is enforced through compose
    dependencies
  - `built:up`: single compose bring-up command for the `built` profile
  - `dev:down`: hard-stop runtime and preserve persistence volumes
  - `dev:down-reset`: hard-stop runtime and remove persistence volumes
- Local runtime teardown prioritizes developer iteration speed over graceful local service shutdown or telemetry flush
  behavior.
- `dev:up` startup output includes a concise local access link summary derived from compose-exposed service ports.
- Local runtime environment variables are sourced by `mise` from a project `.env` file.
- `vm:gh:ensure` is idempotent and either creates the configured worktree-scoped GitHub-like Lima VM or reconciles the
  existing same-name instance to the current folder's mount and configured VM settings before starting it.
- `vm:gh:ensure` provisions the guest shell baseline needed for repo commands by ensuring `mise` is installed and
  activated inside the guest.
- `vm:gh:ensure` does not silently delete or recreate existing Lima instances.
- App startup command roles are explicit:
  - dedicated bootstrap command delegates app-schema migration apply to `app:drizzle-migrate`, then runs Graphile
    migration plus optional env-driven seeding
  - API startup serves `api` only after bootstrap has already completed
  - startup seeding is env-driven via `APP_STARTUP_SEED_PACK` (`none`, `baseline`, `demo`, default `none`)
  - local runtime wiring sets `APP_STARTUP_SEED_PACK=baseline` on the bootstrap service
  - deployed bootstrap wiring sets `APP_STARTUP_SEED_PACK=none`
  - jobs startup runs `worker` only
- Schema bootstrap logic is exposed as a separate app command and compose/job entrypoint (`app:bootstrap`), not owned by
  API startup.
- Raw checked-in Drizzle migration apply is exposed as a dedicated app subcommand (`app:drizzle-migrate`) so
  `app:bootstrap` reuses Drizzle Kit semantics rather than reimplementing them in runtime code.
- `e2e:smoke:*` owns bring-up and teardown of the isolated compose-managed `e2e` stack rather than depending on a shared
  always-on `dev:up` runtime.
- `e2e:stack:up` / `e2e:stack:down` expose the same isolated stack lifecycle for iterative local debugging and headed
  runs.
- `e2e:run:*` reuses the persisted host-side e2e runtime state and leaves the stack running after the browser session
  ends.
- `e2e:run:headed` and `e2e:run:ui` are local-only interactive variants of the host runner path.
- `e2e:smoke:headless` maps to host-run Playwright execution against the isolated `e2e` stack.
- `e2e:smoke:headed` maps to the same host-run path with headed Chromium and local-focused worker defaults.
- `e2e:smoke:container` maps to container-run Playwright execution against the same isolated `e2e` stack contract.
- `e2e:smoke:headless` requires Chromium coverage in baseline workflows.
- The local compose topology is explicitly split into `dev`, `built`, `test`, and `e2e` profiles.
- `dev` and `built` use distinct `APP_DB_SCHEMA` and `JOBS_GRAPHILE_SCHEMA` values so they can run concurrently without
  sharing app or queue state.
- `test-integration` and `e2e:*` target the dedicated shared `test` Postgres rather than the `dev` / `built` runtime
  database.
- The shared test database owns `public` as the canonical template schema for disposable integration/e2e app schemas.
- `deps:check` is advisory-first and does not fail solely because dependencies are behind latest versions.
- Tasks that require repository `node_modules` depend on one canonical install task, `deps:install`, rather than relying
  on workflow-local `pnpm install` steps.
- Dependency commands cover managed dependency surfaces from npm manifests/lockfile, `mise` tool definitions, and local
  container image references.
- `deps:check` includes toolchain drift checks for local `mise`, `node`, and `pnpm` versions as part of the toolchain
  dependency surface.
- Local compose/runtime commands load env values through `mise` env configuration.
- New reusable wrapper tasks stay thin and delegate to underlying scripts/tools; when a workflow needs complex shell
  logic, it moves into a dedicated file task or repo script instead of growing inline TOML.
- `fmt` applies repository-supported formatting for TypeScript/source assets and lint autofixes.
- `fmt-check` remains non-mutating for formatter-managed file types with dedicated check behavior.
- GitHub Actions log retrieval is available through canonical `mise` tasks (`gh:runs`, `gh:logs`, `gh:job-logs`) backed
  by `gh` in the managed toolchain.
- Migration from legacy command wrappers does not invent unsupported command names.
- Developer-facing docs reference canonical command surface guidance rather than duplicating ad hoc command chains.
- New reusable wrapper tasks use `usage` arg passthrough and delegate to the underlying CLI tool rather than embedding
  complex shell logic.
- When a frequently used command needs a single argument that may contain spaces (for example Playwright `--grep`
  patterns), the canonical command surface should expose a dedicated named task for that argument rather than relying on
  fragile shell-quoting passthrough.

### Should:

- Command names are concise and action-oriented once defined.
- Command outputs clearly state delegated commands for debugging.
- If low-level command examples are documented, include the canonical command-surface equivalent first.
- For new wrapper tasks, keep run blocks concise and split variants into separate tasks when it improves readability.
- Non-Chromium e2e browser runs (for example Firefox/WebKit) should be opt-in or non-blocking until baseline smoke
  stability is proven.

### May:

- Split command definitions across multiple files once the command catalog is specified.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
