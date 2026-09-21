# Effort

- Name: Standings selection gets its own URL parameters
- Date: 2026-09-21
- Time: 18:10
- Plan Approved By:
- Plan Approved At:

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
- Changing Previous Seasons handling (keeps its local component state).

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v8)
- [/CONTEXT.md](/CONTEXT.md)
- [/docs/specs/process/repo-layout.md](/docs/specs/process/repo-layout.md)

## Spec Coverage Checklist

- [x] `schedule-viewer.md` lists `standings` and scopes `league` to Team search only.
- [x] `schedule-viewer.md` says `standings`/`division` are validated together and dropped together when invalid.
- [x] `schedule-viewer.md` Standings pill write is `?standings=<slug>&division=<name>`.
- [x] `schedule-viewer.md` carries the transitional old-link note, marked for removal.
- [x] `schedule-viewer.md` Completion section references this effort.
- [x] `CONTEXT.md` "Standings selection" is independent of the Viewer selection, as implemented.

## Plan

- Extend `RawParams`/`ResolvedSelection` with the standings parameter and add `resolveStandingsSelection`.
- Make `resolveViewerSelection` resolve Team search and Standings independently.
- Add the `selectStandings` action to the hook and rewire `StandingsView` and `ViewerApp`.
- Tests through the resolve function: standings/division validation, independence from day/league/team, survival across
  a view toggle, the old-link read and rewrite.
- Acceptance: the criteria listed on issue #9.

## Execution Notes

- Implemented by Sandcastle (RALPH) on branch `sandcastle/sequential-reviewer/1790013990135`, building on the #8 branch;
  reviewer pass flattened `resolveStandingsSelection` with early returns.
- Post-review fixes (code review of `main...HEAD`): the old-link fold now runs before the all-or-nothing storage check
  and consumes `league` only when the pair is valid, so an old-shape link no longer skips storage; the mount effect
  remembers a non-empty resolution and never clears storage; `resolveViewerSelection` returns `urlWrites` which the hook
  applies; the storage seam moved to `selection-storage.ts` with an in-memory adapter and tests; identity planners
  removed; `validateUrlSelection` renamed `validateSelection`.
- Gates: typecheck, lint, fmt-check, and the full unit suite pass.

## Deviations

- No plan approval was given or recorded: the ticket ran unattended via Sandcastle at Kelsey Brennan's direction, with
  the effort-file and approval criteria deliberately dropped from the ticket. The approver fields above are
  intentionally blank.
- This effort file was first written without the template's checklist, plan, execution-notes, deviations, and status
  sections; they were added during the post-review fix pass.

## Status

Done
