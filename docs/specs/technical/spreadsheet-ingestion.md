---
name: Spreadsheet Ingestion
description: CLI-driven ingestion of thescoregr.com Google Sheets into per-league JSON snapshots.
---

# Spreadsheet Ingestion

## Spec Metadata

- ID: T0001
- Type: Technical
- Status: active
- Version: v1
- Last Updated: 2026-04-19

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
- Observed spreadsheet shapes across in-scope leagues:
  - **Vertical schedule** (most leagues, e.g. Sunday Coed 4's): standings block in columns A..F/G (Captain, Wins,
    Losses, Standing/Division, Paid, Waivers), schedule block below with time slots down, court labels, and matchup
    cells containing `"N v M"`.
  - **Horizontal schedule** (e.g. Tuesday Coed 2's): standings block on the left, schedule laid out with date columns
    across the top and time/court rows down.
- Matchup cells always contain two team numbers separated by `v`.
- Winner convention (manual league-admin edit): the team number listed **first** in the cell is the winner once the
  match is played. Cells for unplayed matches retain their original pre-game ordering.
- Cell background color encodes set count:
  - Magenta: the first-listed team won 3-0.
  - Blue: the first-listed team won 2-1.
  - Any other (default/white) background: the match has not been played yet.
- A team's **record** is measured in sets won / sets lost, not matches won / matches lost.

## Requirements

### Must:

- Ingestion is invoked as a `mise` task (e.g. `mise run ingest`) that runs a TypeScript CLI entrypoint under the backend
  source tree.
- The ingestion command has a known, checked-in list of in-scope league sources: `(session, day, sheet_id)` tuples.
  Queen of the Beach sheets are excluded from this list.
- For each in-scope league, the command fetches the sheet via the public XLSX export endpoint
  `https://docs.google.com/spreadsheets/d/<sheet_id>/export?format=xlsx` (no OAuth, public-link access). The XLSX export
  is the authoritative source because it preserves cell background colors; CSV is not used because it strips colors.
- The ingestion pipeline is structured so that the fetch, parse, and write steps can be invoked from a Node runtime
  other than the CLI (specifically a future Next.js route handler) without source changes beyond the entrypoint wiring.
  The core fetch/parse/write functions must not depend on CLI-only APIs (process args, stdout formatting, file paths
  relative to `process.cwd()` for anything other than the snapshots root).
- The parser supports the vertical-schedule shape as the baseline. Horizontal-schedule leagues use a dedicated parser
  variant selected per-league in the source list.
- For every league, the parser produces the snapshot structure defined in
  [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md), including: league identity, teams
  with number and captain, per-team division, matches with date/time/court/teams, and per-match outcome.
- The parser reads the division label from the standings block's Standing/Division column (typically column D) for each
  team. Every team must end up with a division label. If a team row is missing a division label, the parser substitutes
  a single placeholder label shared across the league (e.g. `"A"` for a single-division league) and logs the
  substitution so operators can confirm whether the league actually has one division or a row was missed.
- Record and rank are computed **per division**. Teams are only compared to other teams with the same division label
  when ranking. Inter-division matches are included in both teams' schedules but each team's sets-won/sets-lost total
  for record purposes counts every played match regardless of opponent division.
- Match outcome derivation — only two played states exist:
  - Unplayed: cell color is default/white; no winner, no set score.
  - Played 3-0: cell color is magenta; winner is the first team listed; set score is 3-0 in favor of the winner.
  - Played 2-1: cell color is blue; winner is the first team listed; set score is 2-1 in favor of the winner.
- Any other non-default cell color is treated as a parser error for that match (logged; the match is recorded as
  `unplayed` and the league summary notes the anomaly). The league does not use additional colors for forfeits or 2-0
  defaults.
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
  `failed` with a one-line reason.

### Should:

- The CLI supports a `--league <slug>` flag to ingest a single league.
- The CLI supports a `--dry-run` flag that parses without writing or archiving.
- Parser logic lives under `src/backend/logic/core/` as pure functions over a decoded workbook structure, and the
  Google-Sheets fetch/decode is an adapter under `src/backend/runtime/adapters/integrations/`. This layout is what lets
  the same fetch/parse/write core be re-wired behind a Next.js route handler in the future.
- When the parsed Wins/Losses standings block disagrees with the computed record by more than one set, the CLI logs a
  warning for the operator but still writes the computed record.

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

- Status: Draft
- Remaining: Implementation not started.
