# Effort

- Name: Standings View
- Date: 2026-05-02
- Time: 13:19
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-05-02 13:00

## Scope

Add a third top-level view mode — `standings` — to the single-page viewer. The user picks a league via a flat row of
day/division pills (`Sunday B`, `Sunday BB`, `Sunday BBB`, `Monday B`, …), ordered by day-of-week. The selected pill
renders a per-division standings table with rank, team number/captain, and sets won/lost. Teams with the same
`(setsWon, setsLost)` share a rank, displayed as `T-N`. Teams that have not played any sets yet appear at the bottom of
the table without a rank.

In scope:

- Pure-domain helpers: `buildStandings(snapshot, division)` and `listStandingsOptions(snapshots)` in
  [/src/shared/domain/standings.ts](/src/shared/domain/standings.ts).
- A new client component [/src/components/standings-view.tsx](/src/components/standings-view.tsx) that owns pill
  rendering and the standings table.
- Wiring in [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx): extend `VIEW_MODES` with `"standings"`,
  add a `division` query-param via `nuqs`, render the new view when `view=standings`.
- URL state: `?view=standings&league=<slug>&division=<name>`. Reuses the existing `league` parameter; introduces
  `division`.

Out of scope (non-goals):

- Tie-breakers beyond identical `(setsWon, setsLost)`. The user explicitly declined to invent head-to-head, point
  differential, or other secondary tie-breakers.
- A combined cross-day standings page. One league + one division per render.
- Auto-refresh of the standings view; same one-shot render model as the rest of the app.
- Backend or ingestion changes.
- Playwright e2e coverage (still deferred per the MVP effort).

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v5)
- [/docs/specs/experience/ui-guidelines.md](/docs/specs/experience/ui-guidelines.md)
- [/docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md)

## Spec Coverage Checklist

- [x] `schedule-viewer.md` "View Modes" section documents `team` / `now` / `standings` and the URL contract for
      `?view=standings`.
- [x] `schedule-viewer.md` Requirements section describes the standings view's pill picker, table contents, tie label,
      unranked-team treatment, and empty-state behavior.
- [x] `schedule-viewer.md` "May" bullet about division standings is removed (or rewritten) since standings are now
      implemented.
- [x] `domain-glossary.md` UI Concepts table gains a `Standings view` row pointing at the new component.
- [x] `ui-guidelines.md` typography, color, and spacing tokens are reused — no new ad-hoc colors. Tie label uses the
      existing amber-700 highlight; zebra striping uses `neutral-100`.

## Plan

### Approach

`buildStandings` is the canonical computation. It rebuilds records from `snapshot.matches` rather than reusing
`computeTeamStats` so the standings ranking logic (skip-rank, tie detection, unranked-at-bottom) lives in one place and
is independently testable. The component is presentation-only.

`listStandingsOptions` flattens `{snapshot, division}` pairs into a single ordered list and assigns each a label of
`"<Day> <Division>"`. Day order is canonical (`sunday → friday`), then by snapshot slug as a stable tiebreaker, then
divisions alphabetically. This makes the pill row match the user's mental model regardless of how `snapshots` happens to
be ordered upstream.

### Files touched

- New: [/src/shared/domain/standings.ts](/src/shared/domain/standings.ts).
  - `interface StandingsRow { teamNumber, captain, division, setsWon, setsLost, rank, rankLabel, isTied }`.
  - `interface StandingsGroup { leagueSlug, leagueDisplayName, division, rows }`.
  - `interface StandingsOption { leagueSlug, division, label }`.
  - `buildStandings(snapshot, division): StandingsGroup` — filters teams to the requested division, walks
    `snapshot.matches`, partitions ranked vs unranked (a team is "unranked" iff `setsWon === 0 && setsLost === 0`),
    sorts ranked by `setsWon desc, setsLost asc, teamNumber asc`, then walks the sorted list to assign skip-rank and a
    `T-N` label when a `(setsWon, setsLost)` group has size > 1. Unranked teams are appended at the bottom by team
    number with `rank: null` and `rankLabel: "—"`.
  - `listStandingsOptions(snapshots): StandingsOption[]` — sorts snapshots by canonical day order then slug, emits one
    option per (snapshot, division) sorted alphabetically by division.
- New: [/src/components/standings-view.tsx](/src/components/standings-view.tsx).
  - Pill row mirroring the styling of the existing day-selector pills in `viewer-app.tsx` (teal-on-white when active,
    neutral border when not).
  - Table with three columns: Rank / Team / Sets W–L. Rank uses the same default sans-serif font as the team column;
    tied rows render the rank label in amber-700 + semibold.
  - Zebra background: alternating rows use `bg-white` and `bg-neutral-100`.
  - When ties exist in the rendered table, a footnote below the table explains the `T-N` label.
  - Empty states: "No standings available yet." when there are no options; "No teams in this division." when a division
    has zero teams.
- Edit: [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx).
  - Extend `VIEW_MODES` to `["team", "now", "standings"] as const`; add `ViewMode` alias and `VIEW_LABEL` map.
  - Add `division` query-param using `parseAsString.withOptions({ history: "replace" })`.
  - When `view === "standings"`, render `<StandingsView>` and pass `selectedLeagueSlug`, `selectedDivision`, and an
    `onSelect(leagueSlug, division)` callback that writes both nuqs params.
- New tests: [/src/tests/unit/standings.test.ts](/src/tests/unit/standings.test.ts).

### URL state contract

| Param      | Type    | Empty/default value | Notes                                                               |
| ---------- | ------- | ------------------- | ------------------------------------------------------------------- |
| `view`     | literal | `"team"` (omitted)  | Adds `"standings"` to the existing `team`/`now` enum.               |
| `league`   | string  | `null` (omitted)    | Reused. In standings view, scopes the table to one league snapshot. |
| `division` | string  | `null` (omitted)    | New. Names the division within the selected league.                 |

The standings view does not consult `day` or `team`; those params are preserved across view-mode toggles so switching
back to `team` view restores prior selection.

### Tie semantics

- Two teams are tied iff their `setsWon` and `setsLost` are both equal.
- Rank uses skip-method: if teams in slots `i` and `i+1` are tied, both get rank `i+1`; the next non-tied team gets rank
  `i+3`. (Standard sports convention.)
- Tied teams render `T-N`; non-tied render `N`. Unranked render `—`.
- Tie-breakers beyond `(setsWon, setsLost)` are intentionally not modeled. Teams that share a record share a rank with
  no further ordering claim. Internally `buildStandings` still sorts them by `teamNumber` for deterministic rendering,
  but this is presentation-only and not surfaced as a tie-break.

### Pill ordering

`listStandingsOptions` sorts:

1. By day-of-week (`sunday=0, monday=1, …, saturday=6`).
2. By snapshot slug (stable secondary).
3. Within a snapshot, divisions sort alphabetically (`B < BB < BBB`).

This keeps the row consistent across page loads regardless of how `snapshots` is sorted by `page.tsx`.

### Edge cases

- A division with zero teams: standings table renders a "No teams in this division." message instead of an empty table.
- A division where every team has `0-0`: all rows are unranked, all show `—`. The footnote is hidden because there are
  no ties in the rendered table.
- Snapshots without any teams: `listStandingsOptions` emits no option for that snapshot.
- Pre-season snapshots (no played matches): all options render but every table is fully unranked.
- A user navigating directly to `?view=standings&league=spring-sundays&division=B` lands on the standings table for
  Spring Sundays B. If `division=foo` is invalid, the pill picker simply has nothing selected and the table is hidden;
  no error UI.
- Cross-view switching: leaving standings view preserves `league` and `division` in the URL so a return to standings
  view re-selects the same pill.

### Test strategy

Pure-domain unit tests in [/src/tests/unit/standings.test.ts](/src/tests/unit/standings.test.ts):

- `buildStandings` orders ranked teams by `setsWon desc, setsLost asc, teamNumber asc`.
- Tied teams (identical `setsWon`/`setsLost`) share a rank, labeled `T-N`, with skip-rank applied to the next group.
- Teams with `0-0` are unranked, sorted by team number, appended at the bottom with `rankLabel: "—"` and `rank: null`.
- `buildStandings` only includes teams in the requested division.
- `buildStandings` returns `rows: []` when the division has no teams.
- `listStandingsOptions` emits `{slug, division, label}` triples for every (snapshot, division) pair.
- `listStandingsOptions` orders options by day of week regardless of input order.

Manual smoke: load `/?view=standings&league=spring-sundays&division=BBB`, confirm team 32 shows `4-2` ranked above 31
(2-4) and below the leaders. (See execution notes — verified locally.)

### Acceptance criteria

- [x] Visiting `/?view=standings` renders the new view with the pill row.
- [x] Pills render in canonical day order: Sunday … Friday, divisions A→Z within each day.
- [x] Selecting a pill writes `?league=<slug>&division=<name>` (history replace; no new browser entry).
- [x] The standings table sorts ranked teams by sets won desc / sets lost asc; ties share a rank labeled `T-N`.
- [x] Teams with `0-0` records appear at the bottom, sorted by team number, with `—` for rank.
- [x] Rank and Sets W–L columns use the same sans-serif font as the Team column.
- [x] Rows zebra-stripe with `bg-white` / `bg-neutral-100`.
- [x] When the rendered table contains at least one tied row, a footnote describes the `T-N` marker.
- [x] All quality gates pass: `mise run lint`, `mise run typecheck`, `mise run fmt-check`, `mise run test` (now 122
      tests including 7 new standings tests).

### Assumptions / defaults chosen

- Snapshots are loaded all-at-once and small (~6 leagues), so `listStandingsOptions` sorting on every render is
  inexpensive; no memoization beyond the existing `useMemo` is necessary.
- Skip-rank (1, T-2, T-2, 4) matches user expectation; "dense rank" (1, T-2, T-2, 3) was not requested.
- Day-of-week ordering uses Sunday-first per the existing `DAYS` constant in
  [/src/shared/domain/url-selection.ts](/src/shared/domain/url-selection.ts) (`sunday … friday`); Saturday is supported
  in the lookup map for forward compatibility but no Saturday leagues exist today.

## Execution Notes

- This effort was backported. Implementation landed across two commits during a single chat-driven session before the
  effort file existed:
  - `55235f3` "Add Standings view with per-division tables" — domain logic, component, view wiring, tests.
  - The same commit incorporated four iterative refinements made during the chat:
    1. Replaced the initial `<select>` picker with the day/division pill row to match the existing day-selector pattern.
    2. Sorted pills by day-of-week (instead of input order) so Sunday B leads the row.
    3. Removed the `font-mono` styling from the Rank and Sets W–L columns so they use the same font as the team name.
    4. Added zebra striping at `bg-neutral-100`.
- `buildStandings` deliberately does not call `computeTeamStats`. The two share the same record-aggregation arithmetic,
  but standings need tie detection and the `unranked-at-bottom` partition; rebuilding records inline keeps that logic
  local and testable.
- Verified with the live `data/snapshots/active/spring-sundays.json` after the blue-2-1 fix (commit `d3ea5a0`): the BBB
  division shows team 33 at 6-0 leading, team 32 at 4-2 mid-pack, and unranked teams (those with 0-0) at the bottom.

## Deviations

- The plan's Should/May items in `schedule-viewer.md` listed division standings as a `May:` bullet ("Surface division
  standings as a secondary view adjacent to the team's schedule"). Implementation landed standings as a peer top-level
  view-mode rather than "adjacent to the team's schedule." This deviation is reflected in the spec update made by this
  backport (the bullet is replaced by a Must: clause for the new view).
- No `division` validator exists analogous to `validateUrlSelection`. An invalid `?division=` value silently fails to
  match a pill and the table is hidden. This was an intentional simplification — the tradeoff is that an invalid
  `division` slot is not actively cleaned out of the URL the way invalid `team`/`league` are. Acceptable for v1; can be
  formalized later if it causes confusion.

## Status

Done
