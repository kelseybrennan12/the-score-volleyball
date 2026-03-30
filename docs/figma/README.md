# Figma Docs

This folder contains design-handoff guidance for the starter repository.

What remains here should be treated as lightweight design reference and process guidance, not as a checked-in mirror of
a full Figma application export.

## How To Use This Folder

When a task references Figma or design parity, work in this order:

1. Read this file and [`/docs/figma/specs/README.md`](/docs/figma/specs/README.md).
2. Check the authoritative repo specs in [`/docs/specs/`](/docs/specs/), especially process and experience guidance.
3. Use the current starter UI implementation in [`/src/frontend/`](/src/frontend/) as the source of truth for active
   screens when no newer Figma artifact has been added.
4. If you need side-by-side capture artifacts, use `mise run visual-parity:capture` with the neutral route set in
   [`/scripts/visual-parity/routes.json`](/scripts/visual-parity/routes.json).

## Current Starter Screen Set

The starter-facing screens that matter for design handoff right now are:

- Dashboard
- Database
- Jobs
- Settings

## Usage Guidelines

- Keep design references neutral and starter-safe. Do not reintroduce old client or product branding.
- Convert raw visual tokens into the semantic conventions defined in
  [`/docs/specs/experience/ui-guidelines.md`](/docs/specs/experience/ui-guidelines.md).
- Prefer adapting existing app primitives in [`/src/frontend/components/`](/src/frontend/components/) and
  [`/src/frontend/components/ui/`](/src/frontend/components/ui/) over copying generated exports.
- When a live screen exists, keep the visual code in a dedicated `*View.tsx` file and keep routing/data wiring in the
  container or page file.
- If a future Figma export is checked in, keep it intentionally scoped to the screens being implemented instead of
  storing a full parallel app tree.
