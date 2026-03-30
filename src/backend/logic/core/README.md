# Backend Core

## Purpose

Pure business logic and domain type definitions.

## Allowed File Kinds

- Pure transformation and decision functions.
- Domain value types, invariants, and error/result types.
- Stateless calculation helpers.

## Rules

- Core code is deterministic and side-effect free.
- No IO, no network calls, no DB queries, no environment reads.
- Inputs and outputs are plain values.

## Projection Purity

- All `build*ProjectionDecision` / `build*ProjectionWrites` functions must be pure (no IO, no DB reads).
- They receive pre-fetched inputs and return write instructions.
- Same inputs must always produce same outputs.

## Disallowed Patterns

- Importing API, services, repos, jobs, integrations, or infra modules.
- Hidden side effects (time, randomness, filesystem, network) without explicit value injection.

## Notes for Future Files

- Keep functions small and composable to maximize unit branch coverage.
