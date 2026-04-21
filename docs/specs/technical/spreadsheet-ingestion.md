---
name: Spreadsheet Ingestion
description: CLI-driven ingestion of thescoregr.com Google Sheets into per-league JSON snapshots.
---

# Spreadsheet Ingestion

## Spec Metadata

- ID: T0001
- Type: Technical
- Status: active
- Version: v6
- Last Updated: 2026-04-21

## Summary

Define the command-line ingestion pipeline that pulls league spreadsheets from Google Sheets, parses teams, standings,
schedule, and outcomes, detects season rollovers, and writes per-league snapshots described in
[/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md).

## Goals

- Keep the runtime app off the live Google Sheets API. All reads happen at ingestion time.
- Preserve prior snapshots so historical state is recoverable.
- Automatically recognize a new season when a spreadsheet is reused with a different team roster.
- Capture match outcomes from the manual-edit signals the league uses (team-order flip and cell color).

## Non-Goals

- Continuous/background ingestion. Ingestion is explicitly invoked.
- Writing back to Google Sheets.
- Parsing the Thursday Women's Queen of the Beach tournament format. Those sheets are excluded by the ingestion
  command's source list.

## Source Material

- League index: `https://www.thescoregr.com/volleyball/beach-volleyball-leagues/` Schedules & Standings section.
- Each league outside the Queen of the Beach tournament links to a public Google Sheet. Those standard-format
  spreadsheets are in-scope; the Queen of the Beach sheet is out of scope.
- Observed spreadsheet shape across in-scope leagues: a single grid with the standings block along the top-left (captain
  rows: `"N. Captain Name"` in column A; optional division label elsewhere in the row), a `"Match Time:"` header row
  beneath the standings, and a schedule grid below that — dates as the column headers and time-plus-court rows below
  (e.g. `"6:00pm Blue Ct"` in column A). Matchup cells hold `"N v M"`.
- Division labels are authored in one of two ways across league sheets:
  1. Inline per-row: a `"BB Division"`-style cell in the same row as the team's captain entry (original format).
  2. Range legend block: a set of rows, typically to the right of the standings, of the form
     `"Teams <start>-<end> <sep> <label> League"` — e.g. `"Teams 1-18 \ B League"`, `"Teams 19-30 \ BB League"`. The
     separator may be `\`, `/`, or `|`, and the range delimiter may be a hyphen or an en-dash. This is the format used
     by the current Spring Sundays sheet.
- Some sheets (e.g. Spring Sundays) carry a leftover second `"Match Time:"` block further down the sheet with different
  dates — typically a holdover from a prior season or template. Only the first block is authoritative.
- Date headers are free-form month-plus-day strings (`"April 26th"`, `"June 29"`, `"Jul 27"`, occasionally typo'd as
  `"June 10h"`). No year is carried in-cell; the year comes from the source list.
- Matchup cells always contain two team numbers separated by `v`.
- Winner convention (manual league-admin edit): the team number listed **first** in the cell is the winner once the
  match is played. Cells for unplayed matches retain their original pre-game ordering.
- Cell background color encodes set count:
  - Magenta: the first-listed team won 3-0.
  - Blue: the first-listed team won 2-1.
  - Any other background (default/white, row-stripe yellow, placeholder orange/aqua text blocks): the match has not been
    played yet.
- A team's **record** is measured in sets won / sets lost, not matches won / matches lost.

## Requirements

### Must:

- Ingestion is invokable in two ways that share a single orchestration service (`runIngestion` in
  `src/backend/logic/services/run-ingestion.ts`):
  - CLI: `mise run ingest`, used for local development and as a disaster-recovery fallback.
  - HTTP: `POST /api/admin/ingest`, used by the operator-facing admin tool in production (see
    [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md)).
- The ingestion command reads a checked-in list of in-scope league sources (`LEAGUE_SOURCES`). Each entry carries
  `(slug, displayName, session, year, day, sheetId, defaultDivision?)`. Queen of the Beach sheets are excluded. The list
  is scoped to the currently-active season(s); sheets for a future or not-yet-rostered season are added back to the list
  when the league publishes their roster.
- For each in-scope league, the command fetches the sheet via the public XLSX export endpoint
  `https://docs.google.com/spreadsheets/d/<sheet_id>/export?format=xlsx` (no OAuth, public-link access). The XLSX export
  is the authoritative source because it preserves cell background colors; CSV is not used because it strips colors.
- The fetch/parse/write core is shared between the CLI and the route handler via `runIngestion`. The core must not
  depend on CLI-only APIs (process args, stdout formatting, file paths relative to `process.cwd()` for anything other
  than the snapshots root).
- The runtime-ingestion route handler honors the same per-league failure semantics as the CLI: a single league failing
  does not abort the run; the response reports which leagues succeeded and which failed.
- The runtime-ingestion route handler is rate-limited via the snapshot repo's `getLastIngestedAt` / `setLastIngestedAt`
  pair. The CLI is not rate-limited because it runs in a trusted developer context.
- A single parser is used for all in-scope leagues. It auto-detects the standings block, the schedule's `Match Time:`
  header row, the date-column mapping, and the time-plus-court rows. When multiple `Match Time:` headers appear in a
  sheet, only the first block is treated as authoritative and schedule-row scanning halts when a subsequent header is
  encountered.
- Date-header parsing accepts: full or abbreviated month names (`"June"`, `"Jul"`, `"Aug."`), optional ordinal suffix on
  the day (`"26th"`, `"3rd"`, `"29"`), and tolerates typo'd ordinals (`"10h"`, `"10st"`). It also accepts ISO-8601-style
  strings prefixed with `YYYY-MM-DD`, which is how ExcelJS surfaces a header cell whose raw value is a real `Date`
  (Google Sheets often auto-converts a bare `"April 26"` into a date cell). When a cell does not parse as a date, that
  column is simply skipped.
- For every league, the parser produces the snapshot structure defined in
  [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md), including: league identity, teams
  with number and captain, per-team division, matches with date/time/court/teams, and per-match outcome.
- The parser assigns each team a division using this precedence, stopping at the first hit:
  1. Range legend: if any pre-header cell in the sheet matches `Teams <start>-<end> <sep> <label> League` (separator is
     `\`, `/`, or `|`), the parser builds a `teamNumber → label` map from those rows and uses it. Overlapping ranges log
     an anomaly; the later legend row wins. Reversed ranges (`start > end`) are ignored with an anomaly.
  2. Per-row inline label: a cell in the team's own row matching `"… Division"`.
  3. `defaultDivision` from the source list, or `"A"` if none is declared.

  When a range legend is present but a team number falls outside every range, the parser records an anomaly and uses the
  `defaultDivision`/`"A"` fallback.

- Record and rank are computed **per division**. Teams are only compared to other teams with the same division label
  when ranking. Inter-division matches are included in both teams' schedules but each team's sets-won/sets-lost total
  for record purposes counts every played match regardless of opponent division.
- Match outcome derivation — only two played states exist:
  - Unplayed: cell color is default/white/other; no winner, no set score.
  - Played 3-0: cell color is magenta (`FFFF00FF`); winner is the first team listed; set score is 3-0.
  - Played 2-1: cell color is blue (`FF4A86E8`); winner is the first team listed; set score is 2-1.
- Each team's record is computed by summing sets won and sets lost across all played matches in that snapshot. The
  parser does not trust any pre-tallied Wins/Losses cell in the standings block for the record shown in the app, but may
  read it for cross-check logging.
- Each team's rank is computed per division by ordering on sets-won descending, then sets-lost ascending, then team
  number ascending as a deterministic tiebreaker.
- **New-season detection**: before writing a new snapshot for a league, the command compares the newly-parsed team list
  (team number + captain name for all teams) to the team list in the most recent existing snapshot for that league slot
  (session + day). If the team lists differ in membership, the new snapshot is treated as a new season, recorded with a
  distinct session label, and the prior snapshot is archived rather than replaced.
- **Archival**: any existing snapshot for a league slot is moved to the archive folder before the new snapshot is
  written. The most recent snapshot at the active path is always the one the app serves.
- Per-league parse failure does not abort the command. The CLI continues to the next league and exits non-zero only if
  at least one league failed.
- The CLI emits a human-readable summary at the end: per league, either `ok` with snapshot path and team count, or
  `failed` with a one-line reason. Anomaly log entries (duplicate team numbers, missing division labels, unparseable
  date headers, etc.) are printed beneath each league's line.
- After parsing, the ingestion pipeline runs a set of observational invariants over the parsed teams and matches and
  appends any violations to the same per-league anomaly stream. Invariants are non-fatal — they surface as warnings,
  they do not cause the league to be reported as `failed`. The current invariant set covers:
  - No two matches share the same `(date, time, court)` slot.
  - No team is scheduled in two simultaneous `(date, time)` slots.
  - Matchups never pair a team with itself; referenced team numbers are present in the standings block.
  - Played matches obey the winner-first convention (`outcome.winnerTeamNumber === teamNumbers[0]`) and carry a coherent
    set score (`setsWinner ∈ {2, 3}`, `setsLoser < setsWinner`).
  - Each team's total match count is within ±1 of the modal count for its division (tolerates a single bye week).
  - Every date advertised in the schedule header row whose body carries at least one matchup-shaped cell (`\d+ v \d+`)
    produces at least one parsed match. Columns whose bodies are entirely placeholder text (e.g.
    `"Memorial Day Holiday"`, `"Playoffs Schedule TBD"`) are intentionally reserved by the league admins and are
    excluded from this check. The invariant still fires when a column has matchup-shaped text but strict parsing drops
    every row, which catches typos and format regressions rather than intentional empty weeks.

### Should:

- The CLI supports a `--league <slug>` flag to ingest a single league.
- The CLI supports a `--dry-run` flag that parses without writing or archiving.
- Parser logic lives under `src/backend/logic/core/` as pure functions over a decoded workbook structure, and the
  Google-Sheets fetch/decode is an adapter under `src/backend/runtime/adapters/integrations/`. This layout is what lets
  the same fetch/parse/write core be re-wired behind a Next.js route handler in the future.

### May:

- Cache the raw XLSX export next to the snapshot for debugging.
- Support an `--only-session spring|summer|fall` filter.

## Session and Year Identity

- The checked-in source list is the source of truth for each league's `(session, year)`. The ingestion command does not
  attempt to read a session or year label from the sheet itself — sheet header text is free-form and not guaranteed to
  be present.
- Roster-diff detection (see the Must clause on new-season detection) is the signal that a sheet has been reused for a
  new season. When roster-diff fires, the operator is expected to update the source list's `(session, year)` for that
  league before the next ingestion run.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None for v3. Summer and Fall 2026 leagues return to `LEAGUE_SOURCES` once those sheets are rostered for the
  new season.
