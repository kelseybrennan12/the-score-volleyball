# Runtime Infra Adapters

## Purpose

Runtime adapter implementations for backend infrastructure concerns.

## Allowed File Kinds

- DB client/bootstrap adapters.
- Configuration loading adapters.
- Metrics/telemetry adapters and registries.
- Queue or runtime client adapters.
- Adapter wiring helpers.

## Rules

- Infra modules provide implementation details, not domain interfaces.
- DB adapter usage is allowed only by drizzle repository implementation files.
- Infra-specific types should stay inside adapter boundaries whenever possible.
- Only `src/backend/runtime/adapters/infra/env.ts` may read `process.env`.
- Runtime code consumes typed config exports from `src/backend/runtime/adapters/infra/env.ts`.

## Disallowed Patterns

- Importing infra DB adapters from API/logic/integration modules.
- Exposing adapter-native handles in repo/service public interfaces.
- Reading `process.env` from backend files other than `src/backend/runtime/adapters/infra/env.ts`.

## Notes for Future Files

- Keep adapters swappable and isolated from domain logic.
