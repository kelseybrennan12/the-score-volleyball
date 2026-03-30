# Dependency Currency

## Spec Metadata

- ID: T0019
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define deterministic dependency-currency visibility for managed dependency surfaces so update efforts can be planned
from consistent evidence.

## Goals

- Provide one deterministic dependency-currency check output for local and CI usage.
- Cover all managed dependency surfaces used by the starter runtime and developer workflows.
- Keep the dependency-currency check advisory-first until signal quality and operational thresholds are proven.

## Non-Goals

- Auto-merging dependency updates.
- Selecting update cadence policy for this initial version.

## Requirements

### Must:

- Dependency-currency checks are invokable through `mise run deps:check`.
- `deps:check` reports drift and does not fail solely because dependencies are behind latest.
- Coverage includes:
  - npm direct dependencies from `package.json`
  - toolchain definitions from `mise.toml`
  - local `mise` CLI version
  - container image references from `infra/docker/docker-compose.yml` and Dockerfiles under `infra/docker/`
- Output includes:
  - surface type
  - dependency identifier
  - current version/tag
  - latest version/tag or unknown state
  - status (`up_to_date`, `behind`, `unknown`, `error`)
  - source metadata
- Check output ordering is stable across surfaces and entries.

### Should:

- Check execution continues when one dependency source is unreachable and marks affected entries as `unknown` or
  `error`.
- Registry and API failures are summarized in output so follow-up efforts can triage dependency-source reliability.
- CI executes advisory dependency-currency checks.

### May:

- Add severity classifications and policy thresholds in a follow-up version.
- Extend coverage to additional ecosystems as repository dependency surfaces evolve.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
