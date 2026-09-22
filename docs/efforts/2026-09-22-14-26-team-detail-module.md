# Effort

- Name: One Team-detail module
- Date: 2026-09-22
- Time: 14:26
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-22 14:29 UTC

## Scope

Top recommendation of the 2026-09-22 architecture review (second pass): Team detail, a CONTEXT.md concept, has no
module. Its derivations — the team's matches in order, the opponent of each match, the opponent's record, and the
outcome from the team's own side — are implemented three times, in
[src/components/team-detail.tsx](/src/components/team-detail.tsx),
[src/shared/domain/calendar-export.ts](/src/shared/domain/calendar-export.ts), and
[src/backend/logic/services/build-team-report.ts](/src/backend/logic/services/build-team-report.ts). The viewer's copy
is the one without tests. Alongside, `formatTime` exists three times with two outputs (`6:00pm` and `6:00 PM`) and
`formatTimestamp` three times with two styles.

In scope:

- One deep module in [src/shared/domain/team-detail.ts](/src/shared/domain/team-detail.ts):
  `buildTeamDetail(snapshot, team, now)` returns the team's record row, its matches with opponent, opponent record,
  outcome, and next-match flag, and the next match date. Standings are computed inside; the league-timezone "today" rule
  stays inside via [src/shared/domain/next-match.ts](/src/shared/domain/next-match.ts).
- Team detail (the viewer), the Calendar export, and the per-team report render that result. `buildTeamIcs` and
  `buildReport` keep their interfaces; their existing tests stay untouched.
- The viewer passes the same `now` to the calendar download as it renders against (fixes the dev mock-time mismatch).
- One shared formatting file [src/shared/format.ts](/src/shared/format.ts): `formatTime` (all three copies; Now Playing
  switches to `6:00pm`), `formatDate`, and `formatTimestamp(iso | null)` (all three copies; one explicit en-US style in
  the visitor's local timezone; `null` reads "never"; unparseable input is shown as received). Touches
  [src/components/now-view.tsx](/src/components/now-view.tsx),
  [src/components/admin-app.tsx](/src/components/admin-app.tsx), and
  [src/components/announcement-section.tsx](/src/components/announcement-section.tsx) for the formatter swap only.
- Drop the dead `featured` prop on `MatchRow`.
- Spec deltas (done before this effort): schedule-viewer v10, admin-tool v3, CONTEXT.md Team detail entry.

Out of scope: the other review candidates (Ingestion run, Viewer selection transitions, Announcement/Dismissal, Admin
endpoint, Admin client contract, Season archive edge); the dead exports `findTeamByNumber` and
`readMockNowFromCookieHeader`; trimming the calendar-export or report tests.

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v10)
- [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) (v3)
- [/docs/specs/product/data-freshness.md](/docs/specs/product/data-freshness.md) (v3, unchanged: snapshot timestamp in
  the user's local timezone)
- [/CONTEXT.md](/CONTEXT.md)

## Spec Coverage Checklist

- [x] Team detail's record/rank line, next-match highlight, and each match's opponent, opponent record, and outcome come
      from one `buildTeamDetail` computation shared by the viewer, the Calendar export, and the per-team report.
- [x] Every scheduled match on the next match day (today or later in `America/Detroit`) is flagged as next; no match is
      flagged when every match is in the past or the team has no matches.
- [x] Outcome is reported from the team's own side (`won`, sets for/against, label `W 2-1` / `L 1-2`); unplayed matches
      have no outcome.
- [x] A match whose opponent is missing from the roster still carries the opponent number and a null opponent; the
      calendar and report fall back to the number only (their existing tests keep guarding this).
- [x] The calendar download is generated against the same `now` as the page.
- [x] One `formatTime` renders `6:00pm` in Team detail, the per-team report, and Now Playing.
- [x] One `formatTimestamp` renders `Apr 19, 2026, 2:05 PM` in the visitor's local timezone in Team detail's "Snapshot
      ingested" line and on the Admin page; `null` reads "never"; unparseable input is returned as received.
- [x] `buildTeamIcs(snapshot, team, now)` and `buildReport({...})` keep their interfaces; all 22 of their tests pass
      unchanged.
- [x] CONTEXT.md's Team detail entry names the one computation and its three renderers; AGENTS.md repo surface lists the
      module.
- [x] Typecheck, lint, format check, and the full unit suite pass.

## Plan

Interfaces:

```ts
// src/shared/domain/team-detail.ts
export interface TeamOutcome {
  won: boolean;
  setsFor: number;
  setsAgainst: number;
  label: string;
} // "W 2-1"
export interface TeamMatch {
  match: Match;
  opponentNumber: number;
  opponent: Team | null;
  opponentRecord: StandingsRow | null;
  outcome: TeamOutcome | null;
  isNext: boolean;
}
export interface TeamDetail {
  record: StandingsRow | null;
  matches: TeamMatch[];
  nextDate: string | null;
}
export function buildTeamDetail(snapshot: Snapshot, team: Team, now: Date): TeamDetail;

// src/shared/format.ts
export function formatTime(hhmm: string): string; // "18:05" -> "6:05pm"; unparseable -> as given
export function formatDate(isoDate: string): string; // "2026-04-26" -> "Sun, Apr 26"
export function formatTimestamp(iso: string | null, timeZone?: string): string; // -> "Apr 19, 2026, 2:05 PM" in the
// runtime's local timezone (data-freshness MUST); `timeZone` exists so tests can pin one. null -> "never"
```

Steps:

1. TDD at the `buildTeamDetail` seam in [src/tests/unit/team-detail.test.ts](/src/tests/unit/team-detail.test.ts):
   - only the team's matches, in `compareMatches` order;
   - opponent and opponent record resolved from the snapshot; missing opponent yields `opponent: null` with the number
     kept;
   - outcome from the team's side for a win, a loss, and an unplayed match;
   - `record` is the team's standings row (tie label, division size); `null` when the team is not on the roster;
   - `nextDate` and `isNext`: two matches on the next league night are both flagged; a `now` late on the previous
     evening UTC that is still the same day in Detroit; all-past schedule and empty schedule give `null` and no flags.
2. TDD at the formatting seam in [src/tests/unit/format.test.ts](/src/tests/unit/format.test.ts): `formatTime` at
   midnight, noon, evening, and an unparseable value; `formatDate`; `formatTimestamp` for an ISO instant, `null`, and
   garbage.
3. Implement the two modules.
4. Re-implement [src/shared/domain/calendar-export.ts](/src/shared/domain/calendar-export.ts) and
   [src/backend/logic/services/build-team-report.ts](/src/backend/logic/services/build-team-report.ts) on
   `buildTeamDetail` (and `formatTime` for the report); their existing tests are the gate and are not edited.
5. Move [src/components/team-detail.tsx](/src/components/team-detail.tsx) onto `buildTeamDetail` (one `useMemo`) and
   `format.ts`; pass `now` to `buildTeamIcs`; delete `outcomeLabel`, the three local formatters, and the `featured`
   prop. Swap the local formatters in `now-view.tsx`, `admin-app.tsx`, and `announcement-section.tsx` for `format.ts`.
   Typecheck is the gate (the node-only test policy has no seam for components).
6. Update AGENTS.md repo surface; check off the coverage checklist.
7. Gates: `mise run typecheck`, `mise run lint`, `mise run fmt-check`, `mise run test`. Then a `spec-alignment` audit
   against the frozen spec set (required for a behaviour-changing structural refactor).
8. Commit on this branch and open a PR (approved in the grilling session: PR rather than a push to main).

Explicit defaults chosen:

- `formatTimestamp` keeps the visitor's local timezone because
  [/docs/specs/product/data-freshness.md](/docs/specs/product/data-freshness.md) requires it (MUST); the optional
  `timeZone` argument exists only so the unit test is deterministic. Pinning the league timezone was considered and
  rejected for that reason.
- Grouping matches by date stays a small helper inside the viewer renderer; the module returns a flat, ordered list.
- `buildTeamDetail` computes standings internally; the per-team report therefore recomputes them once per team (tens of
  teams, negligible), keeping the interface to one call.

Acceptance criteria: every item in the Spec Coverage Checklist checked, the PR opened.

## Execution Notes

- Plan approved in chat by Kelsey Brennan after the grilling session that followed the architecture review.
- TDD in vertical slices at the two agreed seams: `buildTeamDetail` (8 tests: own matches in order; opponent, opponent
  record, and missing opponent; outcome from the team's side; own record row and off-roster team; next match day with
  both games of a league night, the Detroit day boundary, and the all-past/empty cases) and `format.ts` (7 tests).
- The three renderers were then moved onto the module with their existing tests as the gate: calendar-export (15) and
  build-team-report (7) pass with no test edits; Team detail, Now Playing, and the two Admin components are gated by
  typecheck (the node-only test policy has no seam for components).
- Verified in the dev preview with the mock-time panel set to 2026-05-03: Team detail shows "Rank T-9 of 18 in B",
  "Snapshot ingested May 2, 2026, 9:05 AM", the May 3 pair under "Next Matches", `7:40pm` times and `L 1-2` / `W 2-1`
  labels; Now Playing shows "Started at 12:10pm".
- Gates: `pnpm run typecheck`, `pnpm run lint`, `pnpm run fmt-check`, `pnpm run test` (225 tests) pass.
  `mise run fmt-check` could not run in this worktree because its `mise.toml` is not yet trusted; the underlying
  `pnpm run fmt-check` was run directly.

- Review: a Standards pass (contributing, testing policy, repo layout, CONTEXT.md vocabulary, Fowler smell baseline) and
  a Spec pass against the frozen spec set ran as parallel sub-agents. The `spec-alignment` audit found every touched
  MUST implemented and test-backed; its one finding was this effort file not being prettier-clean, fixed before commit.
  The data-freshness SHOULD for a relative-time hint ("3 days ago") remains unimplemented and pre-existing, outside this
  scope.

## Deviations

- `buildReport` gained an optional `now?: Date` input (default `new Date()`) so it can call `buildTeamDetail`; the plan
  said its interface would be unchanged. Additive only; its tests did not change.
- `MatchRow` also lost its `hideDate` prop, not only `featured`: both call sites always passed `hideDate`, so the date
  branch was dead too.
- Scope extended during review at Kelsey Brennan's request ("is there any other formatting code we can delete?"):
  `formatDay` joined [src/shared/format.ts](/src/shared/format.ts) and replaced the three weekday label tables in
  [src/shared/domain/standings.ts](/src/shared/domain/standings.ts),
  [src/components/now-view.tsx](/src/components/now-view.tsx), and
  [src/components/viewer-app.tsx](/src/components/viewer-app.tsx). Net effect on production source: about 40 lines fewer
  than main; the added lines are the two seams' tests.
- Standards review changes: `TeamDetail.record` became `standingsRow` (it holds Rank as well as Record); the viewer's
  `upcoming` became `nextMatches` (CONTEXT.md avoids "upcoming"); the report's two identical opponent labels became one
  helper; `formatDate` returns a non-date as given like its siblings.

## Status

Done
