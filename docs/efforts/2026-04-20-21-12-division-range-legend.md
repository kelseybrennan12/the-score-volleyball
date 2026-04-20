# Effort

- Name: Parse Division From "Teams N-M \ X League" Legend Block
- Date: 2026-04-20
- Time: 21:12
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-20 21:15

## Scope

Teach the ingestion parser to derive each team's division from a legend block that lives off to the right of the
standings table on the league spreadsheet — rows such as `Teams 1-18 \ B League`, `Teams 19-30 \ BB League`,
`Teams 31-42 \ BBB League`. This replaces the previous per-row `… Division` label that the league admins have removed
from the Spring Sundays sheet.

In scope:

- Add a range-legend pass in [/src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts) that scans the sheet
  before the schedule header for text matching the `Teams <start>-<end> <sep> <division> League` pattern and builds a
  `teamNumber → division` map.
- Use that map in `parseTeams` as the primary source for a team's division, falling back to the existing per-row
  `… Division` cell, then to the configured `defaultDivision`.
- Re-ingest all Spring sessions to refresh the snapshots under `data/snapshots/active/`.
- Add a small XLSX fixture (or programmatically-built workbook in the unit test) that exercises the new legend format,
  plus a test that keeps the legacy per-row format working.

Out of scope (non-goals):

- Any runtime division override UI.
- Backporting to non-Spring seasons (Summer/Fall 2025 snapshots are not currently ingested, per
  [/src/backend/logic/core/league-sources.ts](/src/backend/logic/core/league-sources.ts)).
- Generalizing the separator beyond what we've observed (backslash / slash / pipe + optional whitespace).
- Reading division labels from merged-cell geometry or font/color cues — pure text match only.

## Spec Set (Frozen)

- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md)
- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md)

## Spec Coverage Checklist

- [x] `spreadsheet-ingestion.md` documents the range-legend format and its precedence vs the per-row `… Division` label
      and the configured `defaultDivision`.
- [x] No other spec disagreements introduced (schedule-viewer's behavior is unchanged; data-snapshots schema is
      unchanged).

## Plan

### Observed new format (Spring Sundays, 2026-04-20)

- Column A rows 2..43 are `"<number>. <captain>"` entries; no division label anywhere in the team row.
- Columns H/I/J, rows 5/6/7 contain `"Teams 1-18 \ B League"`, `"Teams 19-30 \ BB League"`, `"Teams 31-42 \ BBB League"`
  respectively (literal backslash). The same text repeats across three columns because the cells are visually merged.
- The range legend appears before the `"Match Time:"` header row, so it is reachable in the same pre-header scan window
  the parser already uses for team rows.

### Approach

1. Add `buildDivisionRangeMap(ws, anomalies)`: walks rows from row 1 until the `Match Time:` header; for each cell right
   of column A (columns 2..columnCount), tests the text against a single regex and records `(start..end) → division`.
   Later range entries overwrite earlier ones if they overlap, with an anomaly emitted.
2. Regex: `/\bTeams?\s+(\d+)\s*[-–]\s*(\d+)\s*[\\/|]\s*(.+?)\s+League\b/i`. Accepts `\`, `/`, or `|` between the range
   and the division label; accepts plain hyphen or en-dash in the range; captures the division letters (e.g. `B`, `BB`,
   `BBB`, `A`) verbatim and trims whitespace. Case-insensitive.
3. In `parseTeams`, division lookup order:
   - range map (new, primary)
   - per-row `… Division` label (legacy, preserved)
   - `defaultDivision` (fallback)
4. If no range map is found AND no per-row label is found AND no `defaultDivision` is configured, the parser falls back
   to `"A"` as today (no behavior change for that path).
5. Because cell values repeat across merged columns, dedupe range entries by `(start,end,division)` text so we don't
   emit false overlap anomalies.
6. Update `spreadsheet-ingestion.md` to describe the legend-block format and the precedence.
7. Re-ingest Spring Sundays, Mondays, Tuesdays, Wednesdays, Thursdays, Fridays. Review snapshot diffs — Spring Sundays
   should flip from the current mis-parsed single-division state back to B/BB/BBB splits.

### Files touched

- Edit: [src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts) — add range-legend pass and division
  precedence logic.
- Edit: [src/tests/unit/parse.test.ts](/src/tests/unit/parse.test.ts) — add a test for range-legend parsing and another
  asserting legacy per-row label still wins when the legend is absent.
- New (possibly):
  [src/tests/fixtures/spring-sundays-2026-range-legend.xlsx](/src/tests/fixtures/spring-sundays-2026-range-legend.xlsx)
  — the XLSX just downloaded. Only added if synthetic ExcelJS workbook construction in the test is more awkward than a
  committed fixture. Current lean: skip the fixture and construct a minimal workbook in the test body (keeps the fixture
  set small and the test self-contained).
- Edit: [docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) — document the
  legend format and precedence.
- Data: re-ingest refreshes `data/snapshots/active/*.json` and `data/snapshots/archive/<slug>/…`.

### Edge cases

- Range overlap (same number in two different ranges): emit an anomaly; the last legend row wins. Real sheets haven't
  done this, but the parser should not throw.
- Team number outside every declared range: fall back to per-row label → `defaultDivision` → `"A"`, and emit an anomaly
  like `Team 42 not covered by any "Teams N-M \ … League" legend row`.
- Whitespace/newlines inside the legend text (ExcelJS richText): already normalized by the existing `cellText` helper;
  nothing extra needed.
- Cell repeated across merged columns (H/I/J): handled by deduping `(start,end,division)` tuples.
- Lowercase `team` or misspelled `Leauge`: the `\bTeams?\s+…\s+League\b` match is strict-ish. Misspellings don't match
  and the row falls through the fallbacks. Anomaly is emitted only when a team number matches no range.
- Ranges written reversed (`Teams 18-1 \ B League`): treat `start > end` as a parse anomaly and skip that entry.

### Test strategy

Unit tests in `src/tests/unit/parse.test.ts`:

- Construct a minimal `ExcelJS.Workbook` in-memory with: (a) 10 team rows in column A, (b) three legend rows in column H
  (`Teams 1-4 \ B League`, `Teams 5-7 \ BB League`, `Teams 8-10 \ BBB League`), (c) a `Match Time:` header row, and (d)
  one date column with one matchup. Assert that `parseLeagueWorkbook` returns teams with the correct divisions, no
  anomalies.
- A second test keeps one row with a per-row `"BB Division"` label and no legend block — asserts the legacy path still
  returns `"BB"`.
- A third test uses a legend block plus one team outside the declared ranges — asserts fallback to `defaultDivision` and
  an `anomalies` entry mentioning the uncovered team number.
- A fourth test covers slash (`/`) and pipe (`|`) separators to confirm the regex accepts all observed forms.

Existing `parse.test.ts` keeps using `spring-sundays-2026.xlsx` (old format with per-row labels) to guard the legacy
code path. If/when that fixture is regenerated from the new sheet format, the legacy test should be updated then, not
now.

### Acceptance criteria

- [x] Parser returns correct divisions for a workbook whose only division signal is a range legend
      (`Teams N-M \ X League`).
- [x] Parser still returns correct divisions for a workbook with legacy per-row `… Division` labels and no legend.
- [x] When both are present, the range legend wins.
- [x] Uncovered team numbers fall back to the configured `defaultDivision` and emit an anomaly.
- [x] Slash (`\`), forward slash (`/`), and pipe (`|`) separators are all accepted.
- [x] Re-ingesting Spring Sundays produces a snapshot where teams 1-18 are division `B`, 19-30 are `BB`, 31-42 are
      `BBB`.
- [x] `spreadsheet-ingestion.md` documents the legend format and precedence.
- [x] All existing unit tests still pass; `mise run lint`, `typecheck`, `fmt-check` clean.

### Assumptions / defaults chosen

- Division labels in the legend (`B`, `BB`, `BBB`, `A`, …) are written verbatim in the desired display form, just like
  the old per-row `… Division` capture.
- The legend block always lives above the `Match Time:` row. No need to scan the schedule region.
- If `defaultDivision` is unset and nothing else resolves, fall back to `"A"` to preserve current behavior.
- `spring-mondays`/`tuesdays`/`wednesdays`/`thursdays`/`fridays` are unaffected (they still use the per-row or
  default-division path). The re-ingest will confirm.

## Execution Notes

- Added `buildDivisionRangeMap` + regex `/\bTeams?\s+(\d+)\s*[-–]\s*(\d+)\s*[\\/|]\s*(.+?)\s+League\b/i` in
  [src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts). Dedupes merged-cell repeats via a
  `(start,end,division)` seen-set so the H/I/J repetition in the Sunday sheet does not emit false overlap anomalies.
- Five new in-memory workbook tests in [src/tests/unit/parse.test.ts](/src/tests/unit/parse.test.ts) cover legend-only,
  legacy-label-only, legend-beats-legacy, uncovered-number anomaly, and the `/`/`|`/`\` separators.
- Re-ingested all six Spring leagues. Divisions now:
  - Sundays: B (1-18), BB (19-30), BBB (31-42). Matches the legend exactly.
  - Mondays: all B. Tuesdays/Thursdays: all A. Wednesdays: all BB. Fridays: all B.
  - No anomaly output during the run.
- 64/64 unit tests pass; `lint`, `typecheck`, `fmt-check` clean.

## Deviations

- Kept the existing `spring-sundays-2026.xlsx` fixture (old per-row-label format) rather than replacing it with the
  new-format XLSX. The in-memory test coverage already exercises both formats, and keeping the legacy fixture guards the
  per-row-label regression path for sheets that still use it.

## Status

Done
