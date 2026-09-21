# Effort

- Name: Standings selection gets its own URL parameters
- Date: 2026-09-21
- Time: 18:10
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-21 18:10

## Scope

Implement GitHub issue #9 (part of PRD #6): give Standings selection its own `standings` and `division` URL parameters
so browsing standings never disturbs the Team-search day/league/team.

In scope:

- Add `standings` to the raw parameters and `standingsLeague` to the resolved selection in
  [/src/shared/domain/viewer-selection.ts](/src/shared/domain/viewer-selection.ts). A new pure
  `resolveStandingsSelection` validates `standings` against the active snapshots and `division` against the divisions
  present in that snapshot's teams, dropping both when either is invalid.
- `resolveViewerSelection` now validates the Team-search selection (day/league/team) and the Standings selection
  independently on every call; the former standings short-circuit is gone.
- `selectStandings` writes only `standings` and `division` and never touches day, league, or team; the standings
  selection is URL-only and never persisted.
- Transitional old-shape fallback: in the standings view a bare `league` + `division` is read as the standings selection
  and rewritten to `?standings=<slug>&division=<name>` on mount (history-replace); `league` is then re-validated as Team
  search.
- The Standings view receives the Standings selection (`selectedStandingsSlug`) and an `onSelect` callback and no longer
  sees the Team-search `league`.

Out of scope:

- Persisting Standings selection per browser (URL-only, per spec).
- Changing Previous Seasons state handling (keeps its local component state).

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v8)
- [/CONTEXT.md](/CONTEXT.md)
- [/docs/specs/process/repo-layout.md](/docs/specs/process/repo-layout.md)

## Notes

Gates: typecheck, lint, fmt-check, and the full unit suite (181 tests) pass.
