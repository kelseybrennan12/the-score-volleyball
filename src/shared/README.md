# Shared

## Purpose

Cross-runtime contracts and utilities used by both frontend and backend.

## Allowed File Kinds

- Shared type contracts and value schemas.
- Serialization-safe utility helpers.
- Cross-runtime constants with no backend-only dependencies.

## Rules

- Shared modules are implementation-agnostic and runtime-neutral.
- Backend domain core logic remains in `src/backend/logic/core`, not here.
- Shared modules must not import backend infra/repos/services internals.

## Disallowed Patterns

- Storing backend-only orchestration logic in shared modules.
- Importing Node-only or browser-only APIs without explicit boundary wrappers.

## Notes for Future Files

- Prefer simple value contracts that can be used in API clients, services, and tests.
