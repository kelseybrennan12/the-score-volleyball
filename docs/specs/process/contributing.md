# Contributing

## Spec Metadata

- ID: PR0001
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-02-17

This project is spec-driven and values simplicity, clarity, and testability. The goal is to keep core logic easy to
reason about and side effects clearly isolated.

## Principles

- Prefer **simple** over merely **easy**. Avoid accidental complexity.
- Avoid **complecting** concerns. Keep data, logic, and side effects separate.
- Use **data-oriented design**: explicit data shapes and pure transformations where possible.
- Favor **functional core / imperative shell**: Core = pure functions on data. Shell = IO, network, filesystem, timers,
  and orchestration.
- Use the canonical command surface defined in
  [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md).

## Expectations

- New code should preserve clear boundaries between domain logic, orchestration, adapters, and transport concerns.
- Source layout follows the canonical `src/` taxonomy defined in
  [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md).
- Runtime configuration access should be centralized in project settings modules, not direct environment reads scattered
  across feature code.
- In backend code, only `src/backend/runtime/adapters/infra/env.ts` may read `process.env`.
- TypeScript imports should use the `src` base-url style (for example `backend/...`, `frontend/...`, `shared/...`)
  instead of relative path traversal.
- Workflow commands should be discoverable through the canonical command surface docs.
- Repeated workflow commands should be promoted to `mise` tasks instead of duplicated raw CLI snippets.
- New reusable `mise` wrappers should stay concise and primarily pass args through to one underlying CLI command.

## Domain Terminology

For domain terminology, naming conventions, and UI-to-model mappings, see
[domain-glossary.md](/docs/specs/process/domain-glossary.md).

## Canonical Source Taxonomy

```text
src/
  frontend/
  backend/
    api/
    logic/
      core/
      services/
      jobs/
    runtime/
      ports/
      adapters/
      bootstrap/
  shared/
  tests/
```

## Boundary Rules

- `src/backend/logic/core/` contains only pure functions and type definitions.
- `src/backend/logic/services/` performs orchestration sandwiches: unconditional reads, `core` execution, unconditional
  writes.
- `src/backend/logic/services/` enforces ACID update boundaries and transactionally writes job requests.
- `src/backend/logic/services/` does not directly call runtime integration adapters.
- API transport wrappers are thin and live under `src/backend/runtime/bootstrap/` (for example API router/runtime wiring
  modules).
- `src/backend/runtime/adapters/integrations/` wraps external systems/data sources only.
- `src/backend/logic/jobs/` handles slow and integration-heavy workflows outside request/response paths.
- `src/backend/logic/jobs/` follows `read -> core -> write` orchestration with conditional domain logic expressed in
  `src/backend/logic/core/` decision functions.
- `src/backend/logic/jobs/` flushes writes/enqueues/logs unconditionally from decision outputs and maps outcomes to
  completion/failure signaling after flush.
- Jobs/services should prefer bulk write-repo methods over per-row `writeRepo` map loops.
- Integration adapters used by jobs should return typed read outcomes (including retryability metadata) instead of
  requiring handler-local exception parsing for expected provider failures.
- `src/shared/` contains cross-runtime contracts/utilities only, not backend domain core.
- `src/backend/runtime/adapters/infra/env.ts` is the single env access boundary and exports typed config for runtime
  entrypoints.

## Test Taxonomy

- `src/tests/unit/`: high branch-coverage tests for pure logic in `logic/core/`.
- `src/tests/integration/`: happy-path behavior across services/repos/database boundaries.
- `src/tests/contract/`: API and integration interface/schema contracts.
- `src/tests/e2e/`: small happy-path end-to-end set for fast feedback.

## Related

- [`/docs/specs/README.md`](/docs/specs/README.md)
- [`/docs/specs/process/specs-organization.md`](/docs/specs/process/specs-organization.md)
- [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md)
- [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md)
