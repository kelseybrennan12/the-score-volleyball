# Platform Architecture

## Spec Metadata

- ID: T0016
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define the baseline runtime architecture, layering boundaries, and stack choices for the starter repository.

## Goals

- Standardize the initial full-stack runtime shape for local, test, and deployed environments.
- Keep responsibilities explicit across frontend, API, worker, and database services.
- Provide a stable foundation that future projects can extend without inheriting retired client domain behavior.

## Non-Goals

- Defining engagement-specific business workflows.
- Re-introducing retired source-system, spreadsheet, or client-specific infrastructure.
- Prescribing one required cloud provider for all deployments.

## Core Concepts

- Frontend build artifact: React SPA bundle built with the Node/TypeScript toolchain.
- Edge service: Caddy-based runtime that serves built SPA assets and reverse-proxies API/auth traffic.
- API service: Fastify runtime for typed RPC, auth, and health request handling.
- Jobs service: Node/TypeScript worker runtime for slow or asynchronous work.
- Database service: PostgreSQL as the only authoritative relational store.
- Local OIDC simulator service: dedicated auth simulator for local login/discovery/token/JWKS flows.
- Starter surface: the repo intentionally ships a minimal authenticated surface (`dashboard`, `database`, `jobs`,
  `settings`) rather than a product-specific domain model.

## Architectural Rationale

This architecture prioritizes correctness under change, predictable delivery, and operational responsiveness. Service
write paths use `read -> core -> write` so branching decisions stay concentrated in pure core functions and remain easy
to unit test without mocks. Data updates and async follow-up intents are committed together by transactionally
persisting job requests, so API responses and worker processing start from the same committed database truth. Slow or
integration-heavy work is deferred to the jobs runtime to keep HTTP request paths fast. Read/write repository contracts
and ports/adapters boundaries keep services and core logic insulated from Drizzle-specific and provider-specific
details, which makes the starter easier to extend into future projects without reworking the layering model.

## Requirements

### Must:

- The application stack uses Node.js and TypeScript for both frontend and backend code.
- The frontend runtime is a Vite-based React SPA.
- The backend API runtime is Fastify-based.
- The backend includes an independent jobs runtime separate from API request handling.
- PostgreSQL is used in deployed, local, and testing environments.
- Local and test environments run PostgreSQL in containers rather than replacing it with alternate engines.
- Database schema management and migrations use Drizzle tooling and checked-in SQL revisions.
- Runtime bootstrap for schema and seeds is explicit and ordered. API and jobs startup do not mutate schema.
- Startup seed behavior is env-driven via `APP_STARTUP_SEED_PACK`.
- Local development orchestration uses Docker Compose `dev`, `built`, `test`, and `e2e` profiles.
- Local development provides a dedicated mock OIDC provider service.
- Local development observability uses Docker Compose services for `alloy`, `loki`, `prometheus`, `tempo`, and
  `grafana`.
- Provider-specific deployment examples may use the same app and edge images on a managed container platform, but the
  architectural contract remains provider-neutral.
- Runtime configuration reads are centralized through settings/config modules per service rather than scattered direct
  environment reads.
- Backend environment reads are centralized in
  [`/src/backend/runtime/adapters/infra/env.ts`](/src/backend/runtime/adapters/infra/env.ts).
- Backend source boundaries use this canonical structure:
  - `src/backend/logic/core/`: pure functions and type definitions only
  - `src/backend/logic/services/`: orchestration layer for reads, core execution, and writes
  - `src/backend/logic/jobs/`: asynchronous orchestration for queued work
  - `src/backend/runtime/ports/`: side-effect contracts
  - `src/backend/runtime/adapters/`: concrete implementations for runtime ports and external systems
  - `src/backend/runtime/bootstrap/`: composition roots for process wiring and dependency assembly
- Canonical backend process entrypoints live at the backend root:
  - `src/backend/db-bootstrap.entry.ts`
  - `src/backend/api.entry.ts`
  - `src/backend/idp.entry.ts`
  - `src/backend/worker.entry.ts`
- Repository contract files are required under `src/backend/runtime/ports/` and `src/backend/runtime/adapters/repos/`:
  - `read.ts`
  - `write.ts`
  - `drizzle-read.ts`
  - `drizzle-write.ts`
- Service write flows follow `read -> core -> write`.
- Service-level branching logic lives in pure `core/` decision functions, not in service orchestration shells.
- Services transactionally persist job requests for async follow-up work.
- Services do not directly call runtime integration adapters.
- Jobs handler flows follow `read -> core -> write`.
- Job handlers flush decision outputs unconditionally and map decision outcomes to completion or failure signaling.
- When service and job entrypoints address the same behavior, both invoke shared `logic/core/` decision logic.
- Baseline e2e testing runs against the isolated local dockerized `e2e` runtime and owned test database state.

### Should:

- Shared cross-runtime contracts and utilities live in `src/shared/`, while backend domain logic stays in
  `src/backend/logic/core/`.
- Jobs remain small and composable.
- Runtime mode is explicitly configurable (`split` vs `unified`) so local development and production topologies remain
  deterministic.
- Local development uses bind-mounted source with hot reload for frontend and API runtimes.
- Tests are structured under `src/tests/` by kind: `unit/`, `integration/`, `contract/`, and `e2e/`.

### May:

- Introduce additional platform services in follow-up technical specs.
- Add provider-specific deployment overlays without changing the base runtime layering.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Add boundary-enforcement checks/tests to keep layer constraints mechanically enforced.
