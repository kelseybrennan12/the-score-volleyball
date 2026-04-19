# Specs

## Scope

Normative specs for the volleyball league viewer app and the spec-driven process that supports its development.

## Structure

- [`/docs/specs/process/`](/docs/specs/process/): workflow, repo-layout, testing, and agent-process rules.
- [`/docs/specs/product/`](/docs/specs/product/): product behavior for the viewer app (page UX, data freshness).
- [`/docs/specs/technical/`](/docs/specs/technical/): architecture specs for ingestion, snapshots, and deployment.
- [`/docs/specs/experience/`](/docs/specs/experience/): cross-cutting UI guidance.

## Current Product Surface

- `schedule-viewer` — the single Next.js page that renders team schedules, records, ranks, and next matches.
- Ingestion CLI (`mise run ingest`) — the operator-triggered spreadsheet-to-snapshot pipeline.

## Related

- [`/docs/specs/process/specs-organization.md`](/docs/specs/process/specs-organization.md)
- [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md)
