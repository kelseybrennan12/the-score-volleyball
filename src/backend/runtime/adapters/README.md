# Runtime Adapters

## Purpose

Concrete implementations of runtime ports and external provider clients.

## Allowed Contents

- DB adapter implementations.
- External API client wrappers.
- Queue/telemetry/config adapter modules.

## Rules

- Adapter modules are implementation details behind runtime ports.
- Logic layers import ports, not adapter modules.
- Keep provider-specific response parsing and retry mechanics within adapters.

## Disallowed Patterns

- Exposing adapter-native handles in port signatures.
- Embedding business branching that belongs in `logic/core`.
