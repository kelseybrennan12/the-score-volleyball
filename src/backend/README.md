# Backend

## Purpose

Node/TypeScript backend layers split into logic (`logic/`) and runtime (`runtime/`) concerns.

## Allowed File Kinds

- API transport handlers.
- Logic modules (`logic/core`, `logic/services`, `logic/jobs`).
- Runtime ports/adapters/bootstrap modules (`runtime/ports`, `runtime/adapters`, `runtime/bootstrap`).

## Rules

- Respect layer boundaries documented in subfolder READMEs.
- Direct DB access is restricted to runtime adapter repository implementation files.
- Service-to-service calls are disallowed.

## Disallowed Patterns

- Cross-layer imports that bypass folder boundary rules.
- Sharing infra-specific types across public domain/service interfaces.

## Notes for Future Files

- Prefer small, explicit modules with clear ownership per boundary.
- Canonical process entrypoints live at `src/backend/api.entry.ts` and `src/backend/worker.entry.ts`.
