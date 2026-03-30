# Backend Services

## Purpose

Application orchestration layer for request-time business workflows.

## Allowed File Kinds

- Service entrypoint modules for use cases.
- Service orchestration helpers that coordinate repos and core functions.

## Rules

- Service flow is `read -> core -> write`.
- Services own transaction boundaries using repo transaction callbacks.
- Services must use repos via top-level interfaces only.
- Services may not call other services.
- Services may not call integrations directly.
- Services transactionally persist job requests for async follow-up work.
- Services flush writes/enqueues from core decision outputs unconditionally.
- Services do not perform post-write readback to shape return values.
- Services return core-modeled result types (including not-found/no-op outcomes) instead of branching outcome logic in
  the orchestration shell.

## Disallowed Patterns

- Importing `src/backend/runtime/adapters/repos/drizzle-read.ts` or
  `src/backend/runtime/adapters/repos/drizzle-write.ts` directly.
- Importing DB clients from `src/backend/runtime/adapters/infra`.
- Service-to-service imports/calls.

## Notes for Future Files

- Keep service APIs expressed with plain value inputs/outputs.
- For transactional flows, use repo transaction callback APIs rather than direct DB primitives.
