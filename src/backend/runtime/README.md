# Backend Runtime

## Purpose

Side-effect contracts, concrete adapter implementations, and process composition roots.

## Subfolders

- `ports/`: side-effect contracts used by logic layers.
- `adapters/`: concrete implementations for DB, integrations, telemetry, and queue runtimes.
- `bootstrap/`: composition roots that assemble runtime dependencies and process wiring.

## Boundary Rules

- Runtime modules may depend on external libraries and infrastructure-specific types.
- Runtime modules do not encode business decision logic that belongs in `logic/core`.
- `bootstrap/` wires dependencies and process start/stop lifecycles; it should not contain provider protocol details.
