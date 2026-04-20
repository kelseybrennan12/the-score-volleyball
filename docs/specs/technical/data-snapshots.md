---
name: Data Snapshots
description: On-disk JSON snapshot format, filename convention, and archive layout for cached league data.
---

# Data Snapshots

## Spec Metadata

- ID: T0002
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-04-20

## Summary

Define the on-disk format the ingestion pipeline writes and the Schedule Viewer reads: snapshot JSON shape, filename
convention, active-vs-archive layout, and schema versioning.

## Goals

- Keep the runtime app's data access trivial: read one JSON file per league.
- Preserve every ingested snapshot so history is never lost.
- Make filenames self-describing so an operator can identify a file without opening it.

## Non-Goals

- Defining a database schema. Snapshots are flat files, not a relational store.
- Defining UI behavior; see [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md).

## Layout

Two storage backends exist (see [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md)).
Both use the same logical layout:

- Root: `data/snapshots/` (filesystem, for local dev) or `snapshots/` (Vercel Blob, for production)
  - Active: `<root>/active/<league-slug>.json`
  - Archive: `<root>/archive/<league-slug>/<league-slug>-<YYYY-MM-DD-HH-MM-SS>.json`
- `<league-slug>` is a kebab-case identifier combining session and day, e.g. `spring-sundays`, `summer-tuesdays`.
- The active file for a league is always the single most recent snapshot for that league slot.
- Archived files retain the ingestion timestamp in the filename.
- Archive entries are retained across normal ingestion. A rollback moves an archive entry back to the active slot (see
  snapshot-storage); archive entries beyond the 10-entry rollback window may be pruned in a future iteration but are
  otherwise retained.

## Filename Convention

- Archive filename format: `<league-slug>-<YYYY-MM-DD-HH-MM-SS>.json`.
- The timestamp uses UTC with second precision and matches the `ingestedAt` field inside the snapshot.
- Filenames include the league name (via slug) and the date/time the snapshot was cached.

## Snapshot JSON Shape

Every snapshot conforms to this shape (TypeScript-style reference; see
[/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) for how fields are
derived):

```
{
  "schemaVersion": 1,
  "league": {
    "slug": "spring-sundays",
    "displayName": "Spring Sundays",
    "day": "sunday",
    "session": "spring",
    "year": 2026,
    "sourceSheetId": "1WEAya6DXP78Md-FxvfE-Ripk0lo_BWjNY9TY4Tw31v4"
  },
  "ingestedAt": "2026-04-19T14:05:00Z",
  "teams": [
    {
      "number": 1,
      "captain": "Jane Doe",
      "division": "B"
    }
  ],
  "matches": [
    {
      "date": "2026-04-26",
      "time": "18:40",
      "court": "Blue Ct",
      "teamNumbers": [20, 19],
      "outcome": {
        "status": "played",
        "winnerTeamNumber": 20,
        "setsWinner": 3,
        "setsLoser": 0
      }
    },
    {
      "date": "2026-04-26",
      "time": "19:20",
      "court": "Yellow Ct",
      "teamNumbers": [8, 7],
      "outcome": { "status": "unplayed" }
    }
  ]
}
```

## Requirements

### Must:

- Every snapshot file is valid JSON conforming to the shape above.
- `schemaVersion` is an integer. Breaking changes to field names or semantics require incrementing it.
- `league.slug` is unique per league slot (session + day) and is used as the active filename and archive folder name.
- `ingestedAt` is ISO-8601 UTC and equals the timestamp portion of the corresponding archive filename.
- `teams[].number` is unique within the snapshot and matches the numbers referenced in `matches[].teamNumbers`.
- `matches[].teamNumbers` is a two-element array. The first element is the winner when `outcome.status == "played"`.
- `teams[].division` is a required string for every team. For leagues with a single division, all teams share the same
  division label. For leagues with multiple divisions (e.g. Sunday's `B`/`BB`/`BBB`), the label identifies which
  division the team competes in. Division labels are taken verbatim from the spreadsheet's standings block; ingestion
  does not invent or normalize them beyond trimming whitespace.
- `outcome.status` is one of `"played"` or `"unplayed"`. When `"played"`, `winnerTeamNumber`, `setsWinner`, and
  `setsLoser` are present and `setsWinner + setsLoser == 3`.
- The Schedule Viewer reads only from the active path of the selected storage backend at runtime.
- Writers to the snapshot store are: the ingestion pipeline (via the CLI or the runtime ingest route handler) and the
  admin rollback route handler. No other process creates, edits, or deletes snapshot files.

### Should:

- Each match's `date` is a calendar date in the league's local timezone; `time` is 24-hour `HH:MM` in that same
  timezone. The timezone is documented in the league record or inferred as America/Detroit (the league's location).

### May:

- Include a `source` block with raw parser diagnostics (e.g. sheet tab name, parser variant used) for debugging.
- Include a `computedRecords` convenience block that precomputes each team's sets won / sets lost; absent that, the app
  computes it from `matches`.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None for v2.
