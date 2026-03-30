# Runtime Bootstrap

## Purpose

Composition roots that assemble runtime dependencies and start process runtimes.

## What Goes Here

- API/worker/IDP runtime assembly.
- Dependency graph construction (ports + adapters + handlers/services).
- Runtime lifecycle wiring (startup, shutdown, telemetry init/flush).
- Direct runtime modules consumed by process entrypoints:
  - `api-http-runtime.ts`
  - `idp-http-runtime.ts`
  - `backend/jobs` export (worker runtime)

## What Does Not Go Here

- Domain rules and business branching.
- Provider protocol parsing.
- Data mapping logic that belongs in adapters or `logic/core`.
