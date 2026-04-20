# Domain Glossary

## Spec Metadata

- ID: PR0010
- Type: Process
- Status: active
- Version: v4
- Last Updated: 2026-04-20

## Purpose

Map volleyball-league-facing UI labels, conversational terms, and implementation concepts to the current codebase.

## Maintenance Rules

- When a developer answers a terminology question or clarifies a concept during a session, add or update the relevant
  entry before the session ends.

## Term Map

### Domain Concepts

| Term       | Code Location                                                        | Notes                                                                                                     |
| ---------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| League     | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | Day-of-week + session (e.g. "Spring Sundays"). One active snapshot per league slot.                       |
| Session    | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | `spring` / `summer` / `fall`. Carried on the checked-in source list; rollovers surface via roster-diff.   |
| Team       | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | A numbered roster (1..N) led by a captain. Identified by number and captain name.                         |
| Division   | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | A tier inside a league (e.g. `B`, `BB`, `BBB` on Sundays). Record and rank are scoped to the division.    |
| Match      | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | One matchup between two teams at a specific date, time, and court.                                        |
| Outcome    | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | `played` (3-0 or 2-1 for the first-listed team) or `unplayed`. Derived from matchup-cell fill color.      |
| Record     | [/src/shared/domain/stats.ts](/src/shared/domain/stats.ts)           | Sets won and sets lost across all played matches for a team.                                              |
| Rank       | [/src/shared/domain/stats.ts](/src/shared/domain/stats.ts)           | Ordinal position within the team's division.                                                              |
| Next match | [/src/shared/domain/next-match.ts](/src/shared/domain/next-match.ts) | Earliest scheduled match whose calendar date is today or later in the league's timezone.                  |
| Snapshot   | [/src/shared/domain/snapshot.ts](/src/shared/domain/snapshot.ts)     | The JSON document produced by ingestion and served to the UI; see `/docs/specs/technical/data-snapshots`. |

### Ingestion Concepts

| Term           | Code Location                                                                                                              | Notes                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Source list    | [/src/backend/logic/core/league-sources.ts](/src/backend/logic/core/league-sources.ts)                                     | Checked-in `(slug, session, year, day, sheetId)` tuples for in-scope leagues. |
| Sheets fetcher | [/src/backend/runtime/adapters/integrations/google-sheets.ts](/src/backend/runtime/adapters/integrations/google-sheets.ts) | Adapter that fetches XLSX exports from Google Sheets.                         |
| Snapshot repo  | [/src/backend/runtime/adapters/snapshots/fs.ts](/src/backend/runtime/adapters/snapshots/fs.ts)                             | Filesystem reader/writer for `data/snapshots/active/` and `archive/`.         |
| Parser         | [/src/backend/logic/core/parse.ts](/src/backend/logic/core/parse.ts)                                                       | Decodes an `exceljs` workbook into teams + matches + anomalies.               |
| Roster diff    | [/src/backend/logic/core/roster-diff.ts](/src/backend/logic/core/roster-diff.ts)                                           | Detects whether the current team list differs from the previous snapshot.     |
| Ingest CLI     | [/src/backend/ingest.entry.ts](/src/backend/ingest.entry.ts)                                                               | `mise run ingest` entrypoint; orchestrates fetch → parse → archive → write.   |

### UI Concepts

| Term            | Code Location                                                                  | Notes                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Viewer app      | [/src/app/page.tsx](/src/app/page.tsx)                                         | Server Component that loads snapshots and mounts the UI tree.                                                          |
| Day selector    | [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx)               | Buttons for each league day with a cached snapshot.                                                                    |
| Team search     | [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx)               | Lookup by team number or captain name.                                                                                 |
| Team detail     | [/src/components/team-detail.tsx](/src/components/team-detail.tsx)             | Record/rank header, next-match card, chronological schedule.                                                           |
| Calendar export | [/src/shared/domain/calendar-export.ts](/src/shared/domain/calendar-export.ts) | Pure `buildTeamIcs` helper that renders a team's schedule as an RFC 5545 iCalendar string for one-off `.ics` download. |
