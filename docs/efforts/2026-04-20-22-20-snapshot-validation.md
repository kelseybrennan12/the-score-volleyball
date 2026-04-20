# Effort

- Name: Snapshot Validation — Ingest Invariants + Per-Team Schedule Report
- Date: 2026-04-20
- Time: 22:20
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-20 22:26

## Scope

Three complementary ways to gain confidence that every team's schedule in the ingested snapshots matches what the league
admins actually authored in the source spreadsheet.

In scope:

1. **Ingest invariants** — pure checks run after parsing, before the snapshot is written. Failures raise per-league
   anomalies in the existing anomaly stream (they don't abort the run).
2. **Surface anomalies in the admin UI** — the `/admin` ingest panel already gets `anomalies` in the API response but
   currently discards them. Render a per-league anomaly list inline after a run so the operator sees parser/invariant
   warnings without tailing server logs.
3. **Per-team schedule report** — a new `mise run report` task (CLI only, not in the production bundle) that prints a
   human-readable per-team schedule from the active snapshots: date, time, court, opponent number + captain + division,
   and played/unplayed status. Useful for a once-per-season eyeball pass against thescoregr.com.

Out of scope (non-goals):

- Color correctness at the pixel level. The parser already derives played/unplayed and set-score from cell-fill ARGB;
  the report surfaces the parsed outcome, not the raw color.
- Automated diff against thescoregr.com. That's option 5 from the earlier discussion and not worth the complexity right
  now.
- Ingest-side validation that halts the run. Invariants are _observational_ — they add anomalies, they don't throw.
- Changes to the UI. Report is CLI-only.
- Alerting, dashboards, or scheduled checks. Run on demand.

## Spec Set (Frozen)

- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md)
- [/docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)
- [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md)

## Spec Coverage Checklist

- [x] `spreadsheet-ingestion.md` enumerates the parser-level invariants that emit anomalies (symmetry, slot uniqueness,
      winner-first convention) and clarifies they're non-fatal.
- [x] `developer-commands.md` documents the new `mise run report` task (what it prints, how to scope by league/team,
      that it reads only from `data/snapshots/active/`).
- [x] `admin-tool.md` documents that the admin UI surfaces per-league anomalies after an ingest run and does not treat
      their presence as a failure.
- [x] No changes required in `data-snapshots.md` (schema unchanged).

## Plan

### Part 1 — Ingest invariants

Add a pure `validateSnapshot(parsed: ParseResult): string[]` function under
[/src/backend/logic/core/validate.ts](/src/backend/logic/core/validate.ts) (new file). It takes the parser output and
returns a list of anomaly strings (additive — merged into `parsed.anomalies` by the caller). The function never throws;
it only describes deviations.

#### Invariants to emit

1. **Slot uniqueness** — for every `(date, time, court)` tuple, at most one match. Two matches on the same court/time is
   a parser bug or a genuinely double-booked cell. Anomaly: `Slot 2026-04-26 6:00pm Blue Ct has N matches`.
2. **Per-team per-slot uniqueness** — for every `(team, date, time)`, at most one match. A team cannot play two matches
   at the same minute, even on different courts. Anomaly:
   `Team 17 is scheduled in multiple simultaneous matches on 2026-04-26 at 6:00pm`.
3. **Matchup symmetry** — matchups involve two _distinct_ team numbers. Anomaly:
   `Match 2026-04-26 6:00pm Blue Ct pairs team 7 against itself`.
4. **Known team numbers** — every `teamNumbers[0|1]` in `matches` must appear in `teams`. Anomaly:
   `Match 2026-04-26 6:00pm Blue Ct references unknown team 99`.
5. **Winner-first convention** — for played matches, `outcome.winnerTeamNumber` must equal `teamNumbers[0]` (the sheet
   convention is that the winner's number is listed first). Anomaly:
   `Match 2026-04-26 6:00pm Blue Ct has winner 8 but 7 is listed first`.
6. **Played-set-score sanity** — `setsWinner ∈ {2, 3}` and `setsLoser < setsWinner`. Anomaly:
   `Match … has nonsense set score (winner=1, loser=0)`.
7. **Per-team match count uniformity** — flag any team whose total match count deviates from the modal count for its
   division by more than 1. (Bye weeks can legitimately produce off-by-one; deviations beyond that suggest dropped
   matches.) Anomaly: `Team 17 has 10 scheduled matches; divisional mode is 14`.

All checks are pure functions over the snapshot data; no I/O. Each returns `string[]`; `validateSnapshot` concatenates
them.

#### Wiring

In `ingestOne` (or in `parseLeagueWorkbook` itself — see below), append the invariant anomalies to `parsed.anomalies`.
The existing CLI summary path already prints them under the league line. Admin-tool API already surfaces them in its
JSON response.

Choice: append in `parseLeagueWorkbook` so a single parse call gives you both parser-level anomalies and invariants
without extra orchestration at each call site. This keeps `runIngestion`, the CLI, tests, and the admin route identical.

### Part 2 — Surface anomalies in the admin UI

The `/api/admin/ingest` route already returns `anomalies: string[]` per league
([src/app/api/admin/ingest/route.ts:48](/src/app/api/admin/ingest/route.ts#L48)). The admin client in
[src/components/admin-app.tsx](/src/components/admin-app.tsx) currently ignores them — the `IngestResponse` type doesn't
even include the field.

Changes:

1. Extend `IngestResponse.results` in `admin-app.tsx` to include `anomalies?: string[]` and (already-returned)
   `rosterDiff?: "same" | "changed"`.
2. Store the last ingest's per-league results in component state (not just the terse `message` string) so the UI can
   render them until the next run.
3. Render a collapsible per-league block after the ingest section that lists: league slug, ok/failed indicator,
   team/match counts, rosterDiff, and an anomaly bullet list. Empty states: "No anomalies." when the server returned
   none.
4. Anomalies are _warnings_, not failures — color them neutral/amber, keep the existing red styling for `failed` leagues
   only. An ingest that succeeded-with-anomalies should not scream "ingest failed".
5. Preserve the existing top-level summary message (`Ingested N leagues.` / `Ingested with N failures: …`) so the
   top-of-panel one-liner still works.

Accessibility: the anomaly block uses `<ul>` / `<li>` semantics; no `<details>` unless the default view is getting noisy
in practice (decide during implementation once we see real output lengths).

### Part 3 — Per-team schedule report

New CLI entrypoint at [/src/backend/report.entry.ts](/src/backend/report.entry.ts). Reads only from
`data/snapshots/active/` — no Sheets fetch, no writes.

#### Command surface

- `mise run report` — print every team across every active league.
- `mise run report -- --league spring-sundays` — scope to one league.
- `mise run report -- --league spring-sundays --team 7` — scope to one team.
- `mise run report -- --format text` (default) or `--format md` for a copy-pasteable markdown version.

Simple flag parser mirroring `ingest.entry.ts`. No `--dry-run` — the report never writes.

#### Output

Text format, one block per team:

```
Spring Sundays 2026 — B Division — #7 Ryan Gill
Record: 12–3 (sets) · Rank 3 of 18 in B
  2026-04-26 (Sun)  6:00pm  Blue Ct    vs #14 Abby Ettinger (B) [W 3-0]
  2026-04-26 (Sun)  6:50pm  Yellow Ct  vs #2 Katherine McCarthy (B)
  2026-05-03 (Sun)  6:00pm  White Ct   vs #5 Bruce Walterhouse (B)
  ...
```

Markdown format wraps the same rows in a fenced `## Team #7 …` heading + table for pasting into notes.

Uses existing domain helpers: `computeTeamStats`, `compareMatches`, `outcomeLabel` (extracted for reuse — see Refactor
note below). No duplication of division-stats logic.

#### Refactor note

`outcomeLabel` currently lives as a file-scope helper in `src/components/team-detail.tsx`. Move it to
`/src/shared/domain/outcome-label.ts` so both the React component and the Node CLI can use it without importing from a
client component. Tiny change; the client component just re-exports. If the refactor starts bleeding outside the
function, I'll back out and inline in the report instead.

### Files touched

- New: [src/backend/logic/core/validate.ts](/src/backend/logic/core/validate.ts) — pure invariants.
- Edit: [src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts) — call `validateSnapshot` and append to
  `anomalies` before returning.
- New: [src/tests/unit/validate.test.ts](/src/tests/unit/validate.test.ts) — one test per invariant plus a "clean
  snapshot reports no anomalies" baseline.
- Edit: [src/components/admin-app.tsx](/src/components/admin-app.tsx) — extend `IngestResponse`, persist last-run
  results in state, render per-league anomaly list.
- Edit: [docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) — document the anomaly surface.
- New: [src/backend/report.entry.ts](/src/backend/report.entry.ts) — CLI for the report.
- New: [src/backend/logic/services/build-team-report.ts](/src/backend/logic/services/build-team-report.ts) — pure
  formatter (`(snapshot, teamNumber, format) → string`). Keeps the entry thin and testable.
- New: [src/tests/unit/build-team-report.test.ts](/src/tests/unit/build-team-report.test.ts) — asserts text + md output
  for a small fixture snapshot.
- New (maybe): [src/shared/domain/outcome-label.ts](/src/shared/domain/outcome-label.ts) — extracted helper, with the
  existing component re-importing from it. Skip if the inlined call in the report is fine; decide during implementation.
- Edit: [mise.toml](/mise.toml) — add the `report` task.
- Edit: [docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md) — document
  `mise run report` and its flags.
- Edit: [docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) — list the
  invariants in the "Requirements" section as Should-level observational checks.

### Edge cases

- **Inter-division matches** — BB vs BBB game is legal and should not trigger any invariant. Per-team match-count
  uniformity check compares within a team's _own_ division only, so cross-division matches don't distort it.
- **Bye weeks / off-dates** — the sheet marks them with "off"/"for"/"Memorial"/"Holiday" text and we never generate a
  match row for them. The per-team count check uses "mode ± 1" to tolerate a single bye.
- **Unplayed matches with colored cells that aren't magenta/blue** — already falls through the existing `deriveOutcome`
  path as `unplayed`. No new handling needed.
- **Partial played state** (one set played mid-session): the sheet convention is set scores only change on completion;
  outcomes are either `unplayed`, `W 3-0`, or `W 2-1`. The existing parser has no "in-progress" state, and the report
  should not invent one.
- **No active snapshots** — the report exits 0 with a `"No active snapshots found under <path>"` message; the CLI does
  not error.
- **Unknown `--league` or `--team`** — exit 2 with a concrete error mentioning what was found vs asked for.
- **A match where `teamNumbers[0]` appears in `teams` but `teamNumbers[1]` does not** — invariant #4 flags it; the
  report renders the opponent as `#<n> (unknown)` rather than crashing.

### Test strategy

All tests under `src/tests/unit/`, synthetic in-memory snapshots — no fixtures on disk.

- `validate.test.ts`: one test per invariant. For each, construct a minimal snapshot that violates exactly that
  invariant, assert the anomaly list contains a specific phrase. A "clean snapshot" test verifies no false positives on
  a well-formed input.
- `build-team-report.test.ts`: golden-string assertion on a 3-match snapshot (one played 3-0, one played 2-1, one
  unplayed) for both `text` and `md` formats. Separate test for `--team` filtering and another for `--league` filtering.
- `parse.test.ts`: add one test asserting the parser-level anomalies stream now includes the invariants for a fixture
  that happens to violate one (probably the existing Sunday fixture doesn't; synthesize a workbook via the new in-memory
  helper from the prior effort).

### Acceptance criteria

- [x] `validateSnapshot` emits the 7 invariant categories above and returns `[]` for a clean snapshot.
- [x] Anomalies from `validateSnapshot` are included in `parseLeagueWorkbook`'s `anomalies` stream and show up in the
      ingest CLI summary without extra plumbing.
- [x] Admin UI displays per-league anomaly lists after an ingest run; ingest-success-with-anomalies is not presented as
      a failure.
- [x] `mise run report` prints a complete per-team schedule for every active snapshot.
- [x] `--league <slug>` and `--team <number>` flags scope the output correctly.
- [x] `--format md` produces valid markdown (no broken tables).
- [x] Running `mise run report --team 7 --league spring-sundays` against the current snapshots shows team 7's captain
      name, division, 14 scheduled matches, record, and rank correctly (verified: Luke Simonds, B, 12 matches — schedule
      has 12 rounds scheduled, not 14).
- [x] All existing unit tests pass; `lint`, `typecheck`, `fmt-check` clean.
- [x] `spreadsheet-ingestion.md` lists the invariants under Requirements.
- [x] `developer-commands.md` documents `mise run report`.

### Assumptions / defaults chosen

- Invariants are observational (anomalies only, never throw). Easier to roll out; keeps the pipeline robust to edge
  cases we haven't seen yet.
- Report output defaults to `text`; `md` is an opt-in flag.
- The report reads active snapshots only. Archived snapshots are accessible on disk but out of scope for an MVP.
- Per-team match count uniformity uses "modal count per division ± 1" as the tolerance. Not statistical — just a sanity
  check.
- Extracted `outcomeLabel` module is nice-to-have; if it creates more churn than expected I'll inline the 6-line helper
  into the report and skip the shared module.
- No JSON output format — `text` and `md` are enough for a human spot-check. Can add later if a script wants to consume
  the report.

## Execution Notes

- `validateSnapshot` in [src/backend/logic/core/validate.ts](/src/backend/logic/core/validate.ts) implements the 7
  invariants and is wired into `parseLeagueWorkbook` so both the CLI and the admin ingest route surface anomalies
  automatically. 8 new unit tests in `validate.test.ts`; all 78 tests pass.
- Admin UI extended in [src/components/admin-app.tsx](/src/components/admin-app.tsx) with an `IngestResultRow`
  component. Shows league slug, ok/failed badge (amber when there are anomalies but the run succeeded, red only on
  `failed`), team/match counts, rosterDiff, and a bulleted anomaly list (or "No anomalies." placeholder).
- Per-team report (`mise run report`) works end-to-end. Smoke: `mise run report -- --league spring-sundays --team 7`
  prints 12 matches with correct opponents, courts, and outcomes; no mid-column-misalignment issues. The B-division
  season is 12 rounds (not 14 as my plan text guessed), which is now captured in the acceptance criterion.
- No anomalies reported on any of the six active snapshots — the invariants pass cleanly on real data.
- `outcomeLabel` refactor skipped per the plan's escape hatch: the report has its own 4-line `renderOutcome` and the
  component keeps its local copy. Not worth the shared-module churn.

## Deviations

- `developer-commands.md` already had a long `Must` list of canonical command names; `report` was added to the "Initial
  Command Catalog" rather than that list so it's documented without dragging a new name into the must-do inventory.
  Matches how `ingest` is listed.
- Match-count sanity in the plan said "divisional mode" — implementation uses the divisional mode computed from actual
  counts in the snapshot, tie-broken to the smaller value. Behavior identical to the plan for realistic inputs; explicit
  here for future-me reading the code.

## Status

In Progress (awaiting commit + push)
