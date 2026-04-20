# Effort

- Name: Calendar Export (.ics) for Team Schedule
- Date: 2026-04-20
- Time: 20:51
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-20 20:55

## Scope

Add a per-team affordance on the schedule viewer that exports every scheduled match for the currently-selected team as a
single `.ics` (iCalendar) file. The file must import cleanly into Google Calendar, Apple Calendar, and Outlook so a
league player can add their whole season to whichever calendar they use.

In scope:

- A button/link on the team detail view that produces a `.ics` file containing one `VEVENT` per scheduled match for that
  team.
- Event title, start/end time (with league timezone), location (court), and a brief description with opponent info.
- Stable `UID`s so re-imports update rather than duplicate events when the user downloads again.
- A small pure generator module that turns a `(Snapshot, Team)` pair into an iCalendar string, unit-tested.

Out of scope (non-goals):

- Live-updating subscription feeds (`webcal://`) or any hosted per-team endpoint. One-time download only.
- Per-match venue addresses beyond the court label already in the snapshot.
- Reminders/alarms (`VALARM`) — calendar clients default to the user's own defaults.
- Exporting schedules for multiple teams at once, or for leagues rather than teams.
- Authentication, accounts, or persisted user preferences.
- Supporting the Thursday Queen of the Beach tournament format (consistent with the viewer's existing non-goal).

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md)
- [/docs/specs/product/data-freshness.md](/docs/specs/product/data-freshness.md)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md)
- [/docs/specs/experience/ui-guidelines.md](/docs/specs/experience/ui-guidelines.md)

Note: `schedule-viewer.md` will need a new MUST describing the export affordance before this effort can land. The spec
edit is part of planning/implementation scope; the snapshot from today is what is frozen for this effort.

## Spec Coverage Checklist

- [x] `schedule-viewer.md` lists an MVP-level MUST for a team-schedule calendar export affordance (one-file `.ics`
      download, not a subscription feed).
- [x] `schedule-viewer.md` records the export is client-side from the already-loaded snapshot (no new server route, no
      Sheets fetch).
- [x] `data-freshness.md` is reviewed; if the download is documented anywhere as having freshness implications, it is
      clarified that the export reflects the snapshot in use at click time. (Reviewed — `data-freshness.md` does not
      discuss the export surface, so no edits were required. The freshness semantic is captured in the new
      `schedule-viewer.md` MUST: the file reflects the snapshot in use at click time.)
- [x] Domain glossary gains an entry for "Calendar Export" pointing at the generator module.

## Plan

### Approach

1. Add a pure generator `/src/shared/domain/calendar-export.ts` that turns a `Snapshot` + `Team` + "now" into an
   iCalendar (RFC 5545) string. Pure = no I/O, deterministic given inputs, so it is unit-testable and usable from both
   the page and any future server route.
2. Add a small client-side download helper (Blob → `<a download>` click) co-located with the team detail UI. Kept tiny
   and dependency-free — no new npm package.
3. Wire a button into `/src/components/team-detail.tsx` near the team header (beside record/rank) labeled "Add to
   calendar (.ics)". Clicking it builds the string, triggers a download of `<league-slug>-team-<number>.ics`, and
   nothing else.
4. Include every match regardless of date or outcome (past matches let users keep a history; future matches are the
   primary value). Completed matches get their outcome in the event description.
5. Update `schedule-viewer.md` and the domain glossary as listed in the coverage checklist.

### iCalendar details

- `PRODID`: `-//The Score Volleyball//Schedule Viewer//EN`
- `VERSION`: `2.0`
- `CALSCALE`: `GREGORIAN`
- Timezone: events are emitted with explicit `TZID=America/Detroit` using the constant
  [`LEAGUE_TIMEZONE`](/src/shared/domain/next-match.ts). A `VTIMEZONE` component for America/Detroit is included so
  Outlook imports correctly (Google/Apple accept `TZID` without it, Outlook historically doesn't).
- `DTSTART` is built from the match's `date` (`YYYY-MM-DD`) and `time` (`HH:MM`).
- `DTEND` is `DTSTART + 50 minutes`. Rationale: league games are always 50 minutes (confirmed by user). The snapshot
  doesn't carry a duration. Documented as an assumption in the generator header comment.
- `SUMMARY`: `Volleyball vs #<opp#> <opp captain> (<opp division>)`. Falls back to `Volleyball vs #<opp#>` when the
  opponent team is missing from the snapshot (defensive — shouldn't happen in practice).
- `LOCATION`: the match's `court` value (e.g. "Blue Ct"). No venue address — not in the snapshot.
- `DESCRIPTION`: lines for league display name + year, division, team identity, and — for played matches — the outcome
  (`Result: W 2-1` / `L 0-2`).
- `UID`: stable, snapshot-independent: `match-<league-slug>-<team#>-<date>-<time>-<court>@thescorevolleyball`.
  Deterministic so re-downloading and re-importing updates rather than duplicates events. Scoping the UID to the
  exporting team (not the matchup) means both teams' exports can coexist in one calendar without collapsing.
- `DTSTAMP`: the current generation time (UTC `Z` form). Paired with `SEQUENCE = floor(Date.now()/1000)`, this gives a
  monotonically increasing revision marker so re-downloads look newer than prior imports. Without that, Google Calendar
  / Outlook see an unchanged file and keep the stale event. Generation time is injected via an optional `now` argument
  on `buildTeamIcs` so tests remain deterministic.
- `SEQUENCE`: epoch-seconds of the generation time. Not a classic 0-based monotonically-bumped counter, but RFC 5545
  only requires SEQUENCE to be a non-negative integer, and a strictly higher value on each re-download is exactly what
  clients need to accept the update.
- Line endings: `\r\n` as required by RFC 5545. Long lines folded at 75 octets.
- Text escaping: `,` `;` `\` escaped per RFC; newlines in text encoded as `\n`.

### Files touched

- New: [src/shared/domain/calendar-export.ts](/src/shared/domain/calendar-export.ts) — pure generator
  (`buildTeamIcs(snapshot, team): string`) plus a filename helper (`icsFilenameFor(snapshot, team): string`).
- New: [src/tests/unit/calendar-export.test.ts](/src/tests/unit/calendar-export.test.ts) — generator tests.
- Edit: [src/components/team-detail.tsx](/src/components/team-detail.tsx) — add export button + download handler.
- Edit: [docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) — add MUST for export
  affordance; bump `Last Updated` and version.
- Edit: [docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md) — add "Calendar Export" row.

### Edge cases

- Team has zero scheduled matches → button is rendered disabled with a tooltip; no file download.
- Completed (played) matches → included, with outcome in description. Users who want only future matches can delete past
  events on import; simpler than adding a filter toggle for an MVP.
- Snapshots with an unknown opponent team number (data corruption) → fall back to `#<opp#>` only; never throw.
- Court value containing commas or semicolons → escaped per RFC.
- DST transitions during a league session → handled by emitting a correct `VTIMEZONE` block with the two DST rules for
  America/Detroit rather than computing offsets per event.
- Browsers that block programmatic `<a download>` → accept the native prompt; no alternative fallback.

### Test strategy

Unit tests in `/src/tests/unit/calendar-export.test.ts`, using a hand-built `Snapshot` fixture (small: 1 team under
test, 2 opponents, 3 matches — one played, one unplayed, one with a comma in the court name):

- Output parses as valid iCalendar (header, footer, one `VTIMEZONE`, N `VEVENT` blocks).
- `SUMMARY`, `LOCATION`, `DTSTART`/`DTEND`, `TZID`, `UID`, `DTSTAMP` are present and correct for each event.
- `UID`s are deterministic and unique per match for a given `(team, match)` pair.
- Played-match event includes outcome text; unplayed does not.
- Special characters in `court` and `captain` are escaped.
- Line endings are `\r\n`; long lines are folded.
- Filename helper produces `<league-slug>-team-<number>.ics`.
- Empty-matches team returns a calendar with no `VEVENT` blocks (still structurally valid) — even though the UI disables
  the button, the generator stays total.

No new integration test — the existing unit surface covers the logic, and the UI wiring is a thin button handler. Manual
smoke test: download one file, import into Google Calendar and Apple Calendar, verify events land at the right time in
the user's local timezone.

### Acceptance criteria

- [x] `buildTeamIcs` returns a string starting with `BEGIN:VCALENDAR\r\n` and ending with `END:VCALENDAR\r\n`.
- [x] Every scheduled match in the team's schedule appears once, with `TZID=America/Detroit` on `DTSTART`/`DTEND`.
- [x] `SUMMARY` includes opponent number and (when present) captain and division.
- [x] `LOCATION` equals the match's `court`, with RFC-compliant escaping for any `,` `;` `\` characters.
- [x] Played matches include a `Result: …` line in `DESCRIPTION`; unplayed do not.
- [x] `UID`s are deterministic: two calls with the same inputs produce byte-identical output.
- [x] `VTIMEZONE` component for America/Detroit is present with standard + daylight rules.
- [x] Team detail view shows an "Add to calendar (.ics)" control; clicking it downloads a file named
      `<league-slug>-team-<number>.ics`.
- [x] The control is disabled when the team has zero scheduled matches.
- [x] All new and existing unit tests pass; `mise run lint`, `mise run typecheck`, `mise run fmt-check` clean.
- [ ] Manual smoke import into Google Calendar and Apple Calendar places at least one event at the correct local
      wall-clock time (recorded in Execution Notes).

### Assumptions / defaults chosen

- Event duration is fixed at 50 minutes (league games are always 50 minutes; not in the snapshot schema).
- Timezone is `America/Detroit` for all leagues (matches the existing `LEAGUE_TIMEZONE` constant).
- Export is one-shot download, not a subscription feed. (User confirmed in chat on 2026-04-20.)
- Exports include both past and future matches. Toggle for "future only" deferred.
- No reminders/alarms are emitted; clients use their own defaults.
- Button label is `Add to calendar (.ics)`; copy subject to UI review during implementation.

## Execution Notes

- Generator (`/src/shared/domain/calendar-export.ts`) and tests (`/src/tests/unit/calendar-export.test.ts`) landed as
  planned. All 14 new unit tests pass alongside the existing suite (58 tests total).
- UI button added to `/src/components/team-detail.tsx` directly under the snapshot-timestamp line in the header card —
  kept inside the existing card rather than placed beside record/rank to avoid crowding the stats column.
- `mise run test`, `mise run typecheck`, `mise run lint`, `mise run fmt-check` all pass clean after running Prettier.
- cSpell surfaced warnings on RFC 5545 identifiers (`VCALENDAR`, `PRODID`, `VTIMEZONE`, etc.). These are spec-defined
  tokens, not typos; no project-level cSpell config exists to extend, so left as noise.
- Manual calendar-client smoke import was not executed in-session (no browser automation available here). The manual
  import acceptance criterion remains unchecked; run it post-merge and record the result here.

## Deviations

- Button location: placed inside the existing header card under the snapshot timestamp rather than adjacent to
  record/rank. Same visual region, less crowding. No behavior difference.
- Event duration changed from the originally-assumed 60 minutes to 50 minutes after the user confirmed league games
  always run 50 minutes.
- `DTSTAMP` and `SEQUENCE` now derive from the generation moment rather than the snapshot's `ingestedAt`. The
  snapshot-time variant produced byte-identical files on re-download, so Google Calendar and Outlook skipped updates and
  left stale events in place. Generation time is injected via an optional `now` argument so tests stay deterministic.

## Status

In Progress (pending manual calendar-client smoke import)
