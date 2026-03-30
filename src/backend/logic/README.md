# Backend Logic

## Purpose

Business logic layers for pure domain decisions and orchestration.

## Subfolders

- `core/`: pure decision and transformation functions.
- `services/`: request-time orchestration with transactional DB read/write boundaries.
- `jobs/`: async orchestration and enqueue-driven workflow progression.

## Boundary Rules

- Logic code depends on ports/contracts, not adapter implementations.
- Service flows must be `read -> core -> write` in one transaction.
- Job handlers may call integrations and other runtime ports, but should flush a single transactional write boundary per
  terminal path.
- Prefer enqueue-driven branching/fanout over in-handler loops and complex conditional trees.

## Disallowed Patterns

- Importing adapter implementation modules directly from logic handlers.
- Calling service modules from other services.
- Embedding provider-specific IO rules in `core/` modules.
