# Effort

- Name: Parse Date-Cell Schedule Headers; Invariant That Every Header Date Has Matches
- Date: 2026-04-21
- Time: 02:06
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-21 02:06

## Scope

Fix a parser gap discovered by CSV cross-check: when a Google Sheets schedule header cell is an Excel _Date_ value (e.g.
`April 26` standalone), it arrives at the parser as an ISO-8601 string (`2026-04-26T00:00:00.000Z`), which
`parseMonthDay` rejects. The entire column and its matches are silently dropped. Today this is missing all 42 opening
Sunday matches in the Spring Sundays snapshot.

In scope:

1. Teach `parseMonthDay` to also accept ISO-8601 date strings (and any leading `YYYY-MM-DD` prefix, which is what
   `Date#toISOString()` emits via `cellText`).
2. Add a regression test that feeds the parser a workbook whose date-column header is a real `Date` cell.
3. Add a new observational invariant in `validateSnapshot`: every date advertised in the header row must have at least
   one match. This wouldn't have fixed the bug, but would have surfaced it in the admin UI.
4. Re-ingest Spring Sundays so production recovers the missing matches.
5. Promote the existing verifier under [/scripts/verify-sunday-csv.ts](/scripts/verify-sunday-csv.ts) from throwaway to
   documented utility: add a `mise run verify:sunday-csv` task and reference it in `developer-commands.md`.

Out of scope:

- Generalizing the verifier beyond Spring Sundays. Other leagues can use a similar ad-hoc CSV when needed.
- Parsing other cell types (numbers, booleans) as dates.
- Changing the anomaly stream's "warnings vs errors" distinction; header-date coverage is a warning.

## Spec Set (Frozen)

- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)
- [/docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)

## Spec Coverage Checklist

- [x] `spreadsheet-ingestion.md` notes that Excel `Date`-typed header cells are accepted in addition to free-form
      `"Month Day"` strings.
- [x] `spreadsheet-ingestion.md` adds the new "every header date has matches" invariant to the invariant list.
- [x] `developer-commands.md` lists `mise run verify:sunday-csv`.

## Plan

### Parser fix

Extend `parseMonthDay` with a second regex that accepts an ISO date prefix (`YYYY-MM-DD` optionally followed by `T…` /
`Z`). On match, validate `year === input.year` (or if it doesn't, still return the parsed date — the year comes from the
league source so a mismatch is the caller's problem, not the parser's). Keep the existing Month-Day regex as the primary
path.

Regression test: build an in-memory `ExcelJS.Workbook` with one header column whose `.value` is a JS `Date`; assert
`parseLeagueWorkbook` returns matches under the right ISO date.

### New invariant

Add `checkHeaderDateCoverage({ headerDates, matches })` to validate.ts: every date in `headerDates` must appear as at
least one match date. Header dates flow out of `parseSchedule`; thread them into the existing
`ParseResult → validateSnapshot` call.

Emission: `Header advertises <YYYY-MM-DD> but no matches were parsed for that date`.

### Verifier task

New `mise run verify:sunday-csv` that runs the tsx script. Expects the CSV at `tmp/Spring sunday copy - Sheet1.csv`
(path is hardcoded; users drop their CSV there). Task delegates to `pnpm exec tsx scripts/verify-sunday-csv.ts` with no
flags. If the CSV is missing, the script exits with a clear message — add that too.

### Files touched

- Edit: [src/backend/logic/core/date-parse.ts](/src/backend/logic/core/date-parse.ts) — ISO branch.
- Edit: [src/tests/unit/date-parse.test.ts](/src/tests/unit/date-parse.test.ts) — ISO regression.
- Edit: [src/tests/unit/parse.test.ts](/src/tests/unit/parse.test.ts) — end-to-end regression with a Date header cell.
- Edit: [src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts) — expose header dates to the validator.
- Edit: [src/backend/logic/core/validate.ts](/src/backend/logic/core/validate.ts) — new invariant.
- Edit: [src/tests/unit/validate.test.ts](/src/tests/unit/validate.test.ts) — test the invariant.
- Edit: [scripts/verify-sunday-csv.ts](/scripts/verify-sunday-csv.ts) — friendly missing-file message.
- Edit: [mise.toml](/mise.toml) — `verify:sunday-csv` task.
- Edit: [docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) — Date cells +
  coverage invariant.
- Edit: [docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md) — verifier task.
- Re-ingest: `data/snapshots/active/spring-sundays.json` + archived entry.

### Acceptance criteria

- [x] `parseMonthDay("2026-04-26T00:00:00.000Z", 2026)` returns `"2026-04-26"`; unit test added.
- [x] End-to-end parse test with a Date-valued header cell produces matches under the expected ISO date.
- [x] New `checkHeaderDateCoverage` invariant emits an anomaly when a header date has zero matches, and stays silent
      when every header date has at least one match.
- [x] Spring Sundays re-ingest produces 294 matches (up from 252), with opening Sunday 2026-04-26 present on all 3
      courts × 14 time slots.
- [x] `scripts/verify-sunday-csv.ts` run against the refreshed snapshot reports `✅ CSV and snapshot match` (team-order
      warnings allowed for played matches once they start).
- [x] `mise run verify:sunday-csv` works; exits with a clear message when the CSV is missing.
- [x] All existing unit tests pass; `lint`, `typecheck`, `fmt-check` clean.

### Assumptions / defaults chosen

- ISO matcher accepts the `YYYY-MM-DD` prefix only; anything after (`T…Z`) is ignored. Simpler than strict ISO.
- Header-date coverage invariant is a warning, consistent with the rest of the invariant set.
- Verifier stays Spring-Sundays-only until another league needs it.

## Execution Notes

- `parseMonthDay` now has an ISO-prefix branch in front of the Month-Day branch. Three new unit tests cover it.
- Added end-to-end parse-test regression constructing a workbook with a real `Date` cell as a header.
- Threaded `headerDates` out of `parseSchedule` and into `validateSnapshot`; new `checkHeaderDateCoverage` invariant
  lights up when a header date produces zero matches.
- Re-ingesting Spring Sundays jumps from **252 → 294 matches**, with full coverage of 2026-04-26. The verifier now
  reports `✅ CSV and snapshot match on every slot and matchup.`
- The invariant found two real benign cases it should flag: `2026-05-24` (Memorial Day weekend) and `2026-06-21`
  (playoffs placeholder). Both are legitimately empty in the sheet — the cells contain `"Memorial/Day/Holiday"` and
  `"Playoffs Schedule TBD"` placeholder text instead of matchups. The anomaly message accurately reflects reality; an
  operator seeing it can confirm those dates are intentional skips. No code change needed — this is exactly the
  invariant's job.
- `mise run verify:sunday-csv` task added; `scripts/verify-sunday-csv.ts` now exits with a clear message if the CSV or
  snapshot file is missing.
- 82 tests pass; `lint`, `typecheck`, `fmt-check` clean.

## Deviations

- The invariant's anomaly shows up for weeks the sheet deliberately reserves for holidays or playoffs (e.g. May 24, June
  21 on Spring Sundays). That's a known false-positive class but the trade-off of occasional operator-visible anomalies
  is worth catching silently-dropped columns. Documented in the spec; no suppression added.

## Status

Done
