# Effort

- Name: Fall 2026 Season Cutover
- Date: 2026-09-15
- Time: 13:39
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-15 13:39

## Scope

Cut the live app over from Summer 2026 to Fall 2026. The Previous Seasons archive, `archive-season` CLI, and `fall`
session type already exist from
[2026-07-06-21-42-summer-season-cutover.md](/docs/efforts/2026-07-06-21-42-summer-season-cutover.md), so this is a
source-list swap plus whatever the Fall sheets require of the parser.

In scope:

- Point [`LEAGUE_SOURCES`](/src/backend/logic/core/league-sources.ts) at the Fall 2026 sheets that the parser can
  ingest.
- Parser support for the division labels the Fall sheets actually use.
- Spec backport for [`spreadsheet-ingestion.md`](/docs/specs/technical/spreadsheet-ingestion.md).

Out of scope (non-goals):

- Modifying the committed [`data/snapshots/`](/data/snapshots/) tree (same "purge blob only" decision as Summer).
- Running `archive-season --season summer-2026` against Vercel Blob. That is a destructive operational step for Kelsey,
  documented in the runbook below.
- Queen of the Beach ingestion (Fall Thursday). The spec excludes QOTB sheets.

## Spec Set (Frozen)

- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) (v7)
- [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md) (v2)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md) (v3)
- [/docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md)

## Spec Coverage Checklist

- [x] `spreadsheet-ingestion.md` division precedence documents the bare column-B level label (new step 3).
- [x] `spreadsheet-ingestion.md` Completion section and the `LEAGUE_SOURCES` header comment reflect that the live source
      set is Fall 2026 (Sun/Mon/Tue/Wed), with Thursday (QOTB) excluded and Friday pending a 2026 roster.
- [x] `snapshot-storage.md`, `data-snapshots.md`, and `domain-glossary.md` need no change: the seasons model is already
      session-generic, and the glossary's Division/Season rows still hold.

## Plan

### Approach

1. Scrape the Fall 2026 sheet IDs from the public league page and confirm each exports XLSX.
2. Parse every Fall sheet with the existing parser (scratch script, no source-list change) to find format differences.
3. Adjust the parser only where a Fall sheet needs it; swap `LEAGUE_SOURCES`; confirm with
   `pnpm run ingest -- --dry-run`.
4. Backport the spec; run quality gates.

### Fall 2026 sheets (from `https://www.thescoregr.com/volleyball/beach-volleyball-leagues/`, all HTTP 200 XLSX)

| Day | League (page label) | sheetId                                        | Decision                                    |
| --- | ------------------- | ---------------------------------------------- | ------------------------------------------- |
| Sun | Coed 4's B/BB/BBB   | `15tur6KgSRu3kUAqPHmf4sf9TKCOsbo4pvII95Aa7UHA` | Ingest; divisions from column B             |
| Mon | Coed 4's B          | `1G0r-N7PBe5sQENyz5AgNc-4Z1ItuF9aUu63bOeV8QVw` | Ingest; `defaultDivision: "B"`              |
| Tue | Coed 2's B/BB       | `1xikgLuGrFTq0xbusZ-l8xr3R_OBoYIko18oNbLX56F8` | Ingest; `defaultDivision: "B/BB"`           |
| Wed | Coed 4's BB         | `14hShtX2msZDB6K3MWh0QTkI7tiIXGE9NSRYcVGF5R1U` | Ingest; `defaultDivision: "BB"`             |
| Thu | Women's QOTB A & AA | `1Gv4HZJ40yDiebUFMf0ODtmupkzb4x0T2ZVo_zR9OCyc` | Exclude (Queen of the Beach, no team games) |
| Fri | Coed 4's Rec/C      | `1PUJUOCteg_QNocGSrFhR5iWIm08hy-xUTEQzxAL9kDk` | Exclude until rostered (2022 template)      |

### Files touched

- [src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts): `findDivisionInRow` falls back to a bare level
  label in column B (`BARE_DIVISION_LABEL`: one or more of `AAA|AA|A|BBB|BB|B|C|Rec` joined by `/`), after the existing
  `"… Division"` scan and before `defaultDivision`.
- [src/backend/logic/core/league-sources.ts](/src/backend/logic/core/league-sources.ts): replace the six `summer-*`
  entries with `fall-sundays`, `fall-mondays`, `fall-tuesdays`, `fall-wednesdays`; header comment records the Thursday
  and Friday exclusions with their sheet IDs.
- [src/tests/unit/parse.test.ts](/src/tests/unit/parse.test.ts): stub gains `columnBLabel`; three new cases.
- [docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md): v8.

### Edge cases

- **Merged captain text in column B** (Fall Monday row 4 repeats `"1. Jets Pizza (Jessie Gasiorek)"`): not a level
  token, ignored. Covered by test.
- **Column B holding a color or other word** (`"Blue"`): ignored. Covered by test.
- **Both a `"… Division"` cell and a column-B level**: the explicit Division label wins. Covered by test.
- **Range legend present**: still wins over everything (existing test unchanged).
- **Fall is 5 weeks + 1 playoff night**: the playoff column header is `PLAYOFF` (not a date), so it is skipped; each
  ingested league yields exactly 5 dated weeks with zero anomalies.

### Cutover runbook (operational, post-merge, run by Kelsey)

1. Deploy.
2. Trigger an ingest (admin UI or cron) → populates `active/fall-*.json` in Blob.
3. `SNAPSHOT_STORAGE=blob BLOB_READ_WRITE_TOKEN=… pnpm run archive-season -- --season summer-2026 --dry-run`, review
   (expect six Summer leagues), then re-run without `--dry-run`.
4. Verify: live views show Fall Sun–Wed; Standings → Previous Seasons lists Summer 2026 above Spring 2026.

### Test strategy

Parser unit tests (stub workbooks) for the new precedence step; existing Spring fixture tests guard against regressions.
Real-sheet confirmation via `pnpm run ingest -- --dry-run`.

### Acceptance criteria

- [x] `LEAGUE_SOURCES` lists the four ingestible Fall 2026 leagues; `pnpm run ingest -- --dry-run` parses all four
      (teams 18/12/18/12, matches 90/60/90/60).
- [x] Fall Sunday splits into `BB/BBB` (teams 1–12) and `B` (teams 13–18) with zero anomalies.
- [x] New parser tests pass; existing parser tests unchanged and passing.
- [x] Quality gates pass: lint, typecheck, fmt-check, test (141 tests).

## Execution Notes

- `mise` config is untrusted in this worktree, so the equivalent `pnpm run` scripts were used for ingest and gates.
- A scratch parse of all six Fall sheets (before any code change) showed Sun/Mon/Tue/Wed parse with zero anomalies but
  Sunday put all 18 teams in `"A"`: the sheet labels divisions as bare `BB/BBB` / `B` in column B, with no range legend
  and no `"Division"` text. This drove the parser change.
- Fall Thursday parsed as 16 "teams" with 0 matches and duplicate-number anomalies: it is an individual-player QOTB
  sheet (`Wins & (+Pts)` per week), which the spec excludes.
- Fall Friday's sheet still carries `Fall Ball 2022` / `Score Volleyball 2015` headers and 2016 dates, and references an
  unknown team 10. It is not yet rostered for 2026.

## Deviations

- The chat-approved outline assumed all six Fall leagues would be ingested; only four are. Thursday is excluded per the
  existing QOTB rule and Friday per the existing "not-yet-rostered" rule.
- The chat-approved outline did not anticipate a parser change. The column-B division rule was added because the Fall
  Sunday sheet's division labels were otherwise invisible to the parser.
- Tuesday's `defaultDivision` is `"B/BB"` (the league's own label) rather than following the Summer convention of a
  single level (`"A"` for A/AA), matching how the Fall Sunday sheet itself writes combined levels (`BB/BBB`).

## Status

Done

(Code, tests, and spec backport are complete. The production cutover against Vercel Blob — ingest Fall, then
`archive-season --season summer-2026` — remains an operational step, documented in the Cutover runbook above.)
