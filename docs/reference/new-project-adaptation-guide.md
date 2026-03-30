# New Project Adaptation Guide

Use this guide when adapting this repository from the neutral starter into a real client or project implementation.

This file is intentionally temporary. Once the adaptation is complete, verified, and the repo no longer needs starter
transition instructions, delete this file and remove its links from the docs indexes and root README.

## Purpose

- Turn the cleaned starter into a project-specific codebase without reintroducing old product history.
- Keep the retained architecture, command surface, and verification workflow intact while replacing starter
  placeholders.
- Give a coding agent a concrete sequence to follow from discovery through verification.

## Start Here

Read these first:

- [`/README.md`](/README.md)
- [`/AGENTS.md`](/AGENTS.md)
- [`/docs/specs/README.md`](/docs/specs/README.md)
- [`/docs/specs/technical/platform-architecture.md`](/docs/specs/technical/platform-architecture.md)
- [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md)
- [`/docs/specs/process/testing-policy.md`](/docs/specs/process/testing-policy.md)

If the planned changes are structural, behavior-changing, or otherwise loop-driven, create an effort and run
`effort-plan` before editing implementation files.

## Questions To Ask The User

Capture these answers before making broad edits:

1. What is the project display name? Example: `Acme Operations Portal`
2. What is the repo/package slug? Example: `acme-ops-portal`
3. What should the machine-readable snake-case prefix be for metrics, DB names, and IaC names? Example:
   `acme_ops_portal`
4. What short local/test email domain should seeded users use? Example: `acme.local`
5. What should the auth client ID, audience, and session cookie names be?
6. Should the starter page set stay as `dashboard`, `database`, `jobs`, and `settings`, or should those pages be renamed
   or replaced?
7. What minimal example job should replace the current starter job? Choose something client-safe and
   infrastructure-proving, not domain-heavy.
8. Which user personas should exist in seeds and e2e tests? Example: `admin`, `operator`, `viewer`
9. Which deployment surfaces are in scope? Example: local Docker only, or local Docker plus Azure Container Apps
10. Which observability surfaces should remain? Example: Grafana/Prometheus/Loki/Tempo retained, simplified, or removed
11. Should visual parity stay in the adapted project?
12. Which docs should become project-specific specs versus which should stay generic process docs?

Turn the answers into a naming map before editing anything.

## Naming Map To Derive

At minimum, derive values for these placeholders:

- Display name: `Project Starter`
- Kebab-case slug: `project-starter`
- Snake-case prefix: `project_starter`
- Short service prefix: `starter`
- Local email domain: `starter.local`
- Auth client ID default: `project-starter-web`
- Auth audience default: `project-starter-api`
- Session cookie defaults:
  - `project-starter-session`
  - `project-starter-session-built`
  - `project-starter-session-e2e`
- E2E schema cookie default: `project-starter-e2e-schema`
- Azure ACR example: `crprojectstarter`

Do not blindly replace every instance of `starter`. Some uses are intentionally descriptive of the repository role.
Prefer exact search targets and review each match in context.

## Exact Placeholder Search Targets

Use targeted searches like these:

```sh
rg -n "Project Starter|project-starter|project_starter|starter\\.local|project-starter-session|project-starter-e2e-schema|crprojectstarter" .
```

Also sweep the shortened runtime names that may remain valid but may still need project-specific renaming:

```sh
rg -n "starter-api|starter-backend|starter-idp|starter-jobs|starter_jobs|starter_projection" src infra .env.example mise.toml
```

If Azure is retained, also search:

```sh
rg -n "project-starter|project_starter|crprojectstarter" infra/azure
```

## File Groups To Review

Review these groups in order.

### 1. Repo Identity And Human-Readable Copy

- [`/README.md`](/README.md)
- [`/docs/README.md`](/docs/README.md)
- [`/docs/reference/README.md`](/docs/reference/README.md)
- [`/src/README.md`](/src/README.md)
- [`/src/frontend/index.html`](/src/frontend/index.html)
- [`/src/frontend/App.tsx`](/src/frontend/App.tsx)
- [`/src/frontend/features/settings/SettingsPage.tsx`](/src/frontend/features/settings/SettingsPage.tsx)

Update:

- project display name
- sign-in and access copy
- app name labels shown in UI
- root/docs pointers if the project name is now explicit

### 2. Package, Env, And Local Runtime Identity

- [`/package.json`](/package.json)
- [`/.env.example`](/.env.example)
- [`/mise.toml`](/mise.toml)
- [`/infra/docker/docker-compose.yml`](/infra/docker/docker-compose.yml)
- [`/infra/docker/Caddyfile.dev`](/infra/docker/Caddyfile.dev)
- [`/infra/docker/Caddyfile.app`](/infra/docker/Caddyfile.app)
- [`/src/backend/runtime/adapters/infra/env.ts`](/src/backend/runtime/adapters/infra/env.ts)

Update:

- package name
- compose project names
- database defaults
- auth defaults
- cookie names
- local URLs and printed helper output
- service names used in runtime env defaults

### 3. Auth, Seed, And Test Identity

- [`/src/backend/runtime/bootstrap/idp-simulator.ts`](/src/backend/runtime/bootstrap/idp-simulator.ts)
- [`/src/backend/runtime/adapters/infra/db/seed/packs/baseline.ts`](/src/backend/runtime/adapters/infra/db/seed/packs/baseline.ts)
- [`/src/backend/runtime/adapters/infra/db/seed/packs/demo.ts`](/src/backend/runtime/adapters/infra/db/seed/packs/demo.ts)
- [`/src/tests/support/starter-test-runtime.ts`](/src/tests/support/starter-test-runtime.ts)
- [`/src/tests/e2e/`](/src/tests/e2e/)
- [`/src/tests/integration/`](/src/tests/integration/)
- [`/src/tests/unit/`](/src/tests/unit/)

Update:

- seeded user emails
- seeded display names if needed
- auth token audiences and client IDs in tests
- e2e text expectations
- scenario helper defaults

### 4. Frontend Surface Decisions

- [`/src/frontend/router/router.tsx`](/src/frontend/router/router.tsx)
- [`/src/frontend/features/`](/src/frontend/features/)
- [`/src/frontend/layout/`](/src/frontend/layout/)
- [`/docs/figma/`](/docs/figma/)

Decide whether to:

- keep `dashboard`, `database`, `jobs`, and `settings`
- relabel them for the new project
- replace one or more with project-specific pages

If the page set changes, also update:

- breadcrumbs and header copy
- visual parity routes in [`/scripts/visual-parity/routes.json`](/scripts/visual-parity/routes.json)
- Figma docs and page checklists
- e2e smoke tests

### 5. Backend Example Surface

- [`/src/backend/runtime/bootstrap/api-router.ts`](/src/backend/runtime/bootstrap/api-router.ts)
- [`/src/backend/logic/services/`](/src/backend/logic/services/)
- [`/src/backend/logic/jobs/`](/src/backend/logic/jobs/)
- [`/src/backend/runtime/ports/`](/src/backend/runtime/ports/)
- [`/src/backend/runtime/adapters/repos/`](/src/backend/runtime/adapters/repos/)

Adapt:

- the example job
- the example DB metadata prove-out, if the project wants a different starter-safe diagnostic
- naming in logs, comments, and README files

Do not collapse the retained architecture just because the new project starts small.

### 6. Observability And Telemetry Names

- [`/src/backend/runtime/adapters/infra/telemetry.ts`](/src/backend/runtime/adapters/infra/telemetry.ts)
- [`/src/backend/runtime/adapters/infra/metrics/`](/src/backend/runtime/adapters/infra/metrics/)
- [`/infra/docker/observability/`](/infra/docker/observability/)
- [`/infra/azure/observability/`](/infra/azure/observability/)

Update:

- OTEL service names
- metric prefixes if the project wants project-specific telemetry naming
- Grafana dashboard names, UIDs, tags, and cross-links

If the project wants to keep generic telemetry names, make that a deliberate decision and document it.

### 7. Optional Azure Adaptation

Only do this if Azure remains in scope:

- [`/infra/azure/README.md`](/infra/azure/README.md)
- [`/infra/azure/SETUP.md`](/infra/azure/SETUP.md)
- [`/infra/azure/main.bicep`](/infra/azure/main.bicep)
- [`/infra/azure/runtime.bicep`](/infra/azure/runtime.bicep)
- [`/infra/azure/modules/`](/infra/azure/modules/)
- [`/infra/azure/main.bicepparam`](/infra/azure/main.bicepparam)
- [`/.github/workflows/cd.yml`](/.github/workflows/cd.yml)

Update:

- ACR names
- Container App names
- Key Vault and resource names
- auth app names
- dashboard URLs
- observability resource names

If Azure is not in scope for the new project, remove or clearly fence the unused Azure path instead of leaving stale
defaults behind.

## Recommended Execution Sequence

1. Gather the user answers and write the naming map in the task notes or effort file.
2. Rename repo identity, runtime defaults, and auth/test placeholders first.
3. Decide whether the starter page set remains intact or gets replaced.
4. Replace the example job with a safe project-specific example if needed.
5. Update docs and Figma guidance to match the chosen surface.
6. Adapt optional provider-specific infra only after the core local/dev path is working.
7. Sweep for stale placeholders again.
8. Run the verification checklist.
9. Delete this guide and its README/docs links.

## Verification Checklist

Run the relevant retained commands:

- `mise run lint:data-boundaries`
- `mise run typecheck`
- `mise run test`
- `mise run test-integration`
- `mise run e2e:smoke:container`
- `mise run build`
- `mise run dev:up`
- `mise run dev:down`

Then run stale-reference searches:

```sh
rg -n "Project Starter|project-starter|project_starter|starter\\.local|crprojectstarter" . --glob '!pnpm-lock.yaml'
```

If the project replaced the starter page set or auth defaults, also search for the old page names and cookie names that
should no longer remain.

## Done Criteria

The adaptation is complete when all of the following are true:

- The user-approved project name and naming map are applied consistently.
- The current page set, example job, seeds, and tests match the new project.
- Docs describe the adapted project rather than the neutral starter.
- Optional provider-specific surfaces are either updated or deliberately removed.
- The verification commands pass.
- The stale starter placeholder search is clean, except for intentional historical references if the user explicitly
  kept any.

## Final Cleanup

When the new project is stable:

1. Delete [`/docs/reference/new-project-adaptation-guide.md`](/docs/reference/new-project-adaptation-guide.md).
2. Remove its links from [`/README.md`](/README.md) and [`/docs/reference/README.md`](/docs/reference/README.md).
3. If the project has its own onboarding or implementation guide, replace this temporary adaptation file with that
   project-specific documentation.
