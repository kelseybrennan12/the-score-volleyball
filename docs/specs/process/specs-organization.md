# Specs Organization

## Spec Metadata

- ID: PR0002
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-02-11

## Summary

Define how specs and documentation are organized so agents can load context selectively.

## Goals

- Make intent and constraints easy to discover.
- Reduce duplicated guidance across docs.
- Keep spec status in the spec content, not the folder layout.

## Non-Goals

- Prescribing implementation details beyond documentation structure.

## Requirements

### Must:

- [`/docs/specs/`](/docs/specs/) contains only [`README.md`](/docs/specs/README.md) and folders that contain specs.
- Specs use descriptive filenames with no type or ID in the filename.
- Each spec includes a `Spec Metadata` section with ID, type, status, version, and last-updated date.
- Effort filenames start with `YYYY-MM-DD-HH-MM-` and a short slug.
- Efforts include a `Date` field and a `Time` field that match filename prefix values.
- Specs are grouped by conceptual area (not by status).
- Status and lifecycle live in the spec body, not the folder structure.
- Root layout rules live in [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md).
- Team skill rules live in [`/docs/specs/process/agent-skills.md`](/docs/specs/process/agent-skills.md).
- Development loop rules live in [`/docs/specs/process/development-loop.md`](/docs/specs/process/development-loop.md).
- Agent instruction-source and redirect-adapter governance are defined in process specs and surfaced via
  [`/AGENTS.md`](/AGENTS.md), not duplicated across tool-specific files.
- Folder-level `README.md` files exist where rules, audits, or invariants apply.
- Markdown links use absolute repo-root paths (for example [`/docs/specs/README.md`](/docs/specs/README.md)).

### Should:

- Effort/work planning docs live under [`/docs/efforts/`](/docs/efforts/).
- Team skills should be discoverable from [`/AGENTS.md`](/AGENTS.md).
- Process docs should link to authoritative guidance instead of duplicating requirements.
- Docs describing multi-agent support should point to process specs for normative policy wording.
- Page-level specs (per-page layout, components, interactions) live in [`/docs/specs/product/`](/docs/specs/product/)
  with a Design Reference to Figma and [`/docs/figma/specs/pages.md`](/docs/figma/specs/pages.md); they are the single
  source of truth for that page. Cross-cutting UX (e.g. design tokens, accessibility) lives in
  [`/docs/specs/experience/`](/docs/specs/experience/).

### May:

- Add additional conceptual groupings over time as the spec set grows.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Continue rewriting transitional product and technical specs so the starter surface has first-class docs coverage.
