# Audits

## Spec Metadata

- ID: PR0003
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-02-19

## Summary

Define first-class audit types and their canonical execution surface.

## Goals

- Make audits explicit, repeatable, and automatable.
- Keep audit terminology consistent across loop docs and agent skills.

## Non-Goals

- Replacing quality-gate checks (format/lint/typecheck).
- Defining every possible one-off audit a team may run.

## Core Concepts

- Audits are targeted conformance checks.
- Quality gates validate code health; audits validate rules/process alignment.
- Canonical command surface for automated audits uses `mise run`.

## Requirements

### Must:

- Project process guidance defines canonical audit types and expected outputs.
- `spec-alignment` and `link-hygiene` remain supported audit types.
- Audit outputs include file path and line number for each finding.
- Audit commands return non-zero exit status when findings exist.

### Should:

- Audits run fast enough for local pre-merge use.
- Audit output is deterministic and easy to diff in CI logs.
- Folder `README.md` boundary contracts should be used as the primary source when auditing architecture boundaries.

### May:

- Add additional first-class audits as process maturity increases.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
