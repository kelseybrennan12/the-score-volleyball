---
name: Schedule Viewer
description: Single-page UX for a player to find their team's schedule, next game-day, record, and rank.
---

# Schedule Viewer

## Spec Metadata

- ID: P0001
- Type: Product
- Status: active
- Version: v4
- Last Updated: 2026-04-20

## Summary

Define the behavior of the single-page Next.js app that lets a league player pick their league day, identify their team,
and view their schedule, upcoming match day, record, and rank.

## Goals

- Replace manual scrolling through the league spreadsheet with a focused per-team view.
- Make the next upcoming match day visually prominent.
- Show each opponent's current record alongside every scheduled match.
- Remember the user's last selection so reopening the app lands them back on the same team.

## Non-Goals

- Authentication, accounts, or per-user preferences persisted server-side.
- In-app navigation between multiple pages or routes.
- Editing, submitting, or correcting league results from the app.
- Supporting the Thursday Women's Queen of the Beach tournament format. Only standard league spreadsheets are supported.

## Core Concepts

- **League**: A day-of-week plus session (e.g. "Spring Sundays", "Summer Tuesdays"). One active snapshot per league.
- **Team**: A numbered roster (1..N) with a captain name. Teams are identified by both number and captain name.
- **Division**: A tier within a league (e.g. `B`, `BB`, `BBB` on Sundays). Some leagues have a single division, others
  split teams across several. Each team belongs to exactly one division. Record and rank are always scoped to a team's
  division.
- **Match**: One matchup between two teams at a given date, time, and court.
- **Record**: Sets-won and sets-lost, accumulated across all completed matches for a team.
- **Rank**: A team's ordinal position within its division, derived from its record.
- **Next match day**: The earliest calendar date (in the league's local timezone) that has at least one scheduled match
  for the selected team and is today or later. Every scheduled match on that date is considered "next" — a team
  typically plays two games on its league night, and both stay highlighted throughout the day even if the earlier one's
  start time has already passed.

## Requirements

### Must:

- The app is a single page with no in-app navigation or routing away from that page.
- The app does not require authentication.
- The page presents a league-day selector covering every standard league day the ingestion pipeline has cached data for
  (Sunday through Friday, excluding the Thursday Queen of the Beach tournament).
- When a league day has more than one cached session (e.g. Spring 2026 and Fall 2025 Sundays both on disk), the page
  auto-selects the session whose scheduled-match date range contains today; otherwise the next upcoming session;
  otherwise the most recently ended. A league-session dropdown is rendered when more than one session is available so
  the user can override the auto-selection.
- After a league is selected, the page shows the full list of teams for that league by default, ordered by team number
  and (when the league has more than one division) grouped under per-division headers. A search input filters this list
  down as the user types by team number or captain name.
- When a single team is identified, the page shows:
  - The team's number and captain name.
  - The team's division label, record (sets won / sets lost within its division), and current rank within its division
    (e.g. "3rd of 14 in BB").
  - The team's schedule: every scheduled match, grouped by date in chronological order. Each date is rendered as its own
    card with the matches for that day listed inside.
  - For each match: opponent's number, captain name, division, opponent's record (scoped to the opponent's division),
    time, and court.
- When a league has a single division, the division label is still shown but ranking text may omit the label.
- Teams are never ranked or compared across divisions. A BB team's record and rank are computed from BB teams only, even
  if they are scheduled to play a BBB team inter-division (the match still appears on the schedule; the opponent's
  displayed record is scoped to the opponent's own division).
- When at least one scheduled match falls on a date today or later (in the league's local timezone), every match on the
  earliest such date is visually highlighted more prominently than the rest of the schedule, and the page surfaces a
  "Next Match(es)" card that lists those matches with their times and courts.
- If every scheduled match is strictly before today, no match-day highlight is rendered.
- The page shows the league name, session label, and the timestamp of the data snapshot currently in use so users can
  tell how fresh the data is.
- The page reads exclusively from the on-disk cached snapshots described in
  [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md). It does not fetch from Google
  Sheets at request time.
- If no snapshot exists for the selected league, the page shows an empty state explaining that no data has been ingested
  yet.
- The page persists `{ day, leagueSlug, teamNumber }` in the browser's `localStorage` under the key
  `volleyball-viewer:selection` whenever any of those change. On mount it restores any stored entries that still resolve
  against the currently-shipped snapshots (stale entries — a league slug we no longer ingest or a team number that no
  longer exists — are dropped silently and the app falls back to the auto-selected current session).
- The search query text is not persisted.
- The page renders a footer link back to the source standings page at
  `https://www.thescoregr.com/volleyball/beach-volleyball-leagues/` so users can cross-reference the authoritative
  spreadsheet.
- The page title is a hidden admin entry point: triple-tapping it within 600 ms opens a passphrase modal that leads to
  `/admin`. The gesture is invisible to normal users and does not interfere with normal page interaction. See
  [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) for the admin UX details.
- When a single team is identified, the team detail view renders an "Add to calendar (.ics)" control that downloads a
  single iCalendar (RFC 5545) file containing one event per scheduled match for that team. The file is generated
  client-side from the already-loaded snapshot — no additional server route or Sheets fetch — and reflects the snapshot
  in use at click time. The control is disabled when the team has no scheduled matches. This is a one-time download, not
  a live-updating subscription feed; re-clicking regenerates the file from the current snapshot. Events carry
  `TZID=America/Detroit` with an embedded `VTIMEZONE` component so imports work across Google Calendar, Apple Calendar,
  and Outlook.

### Should:

- Team lookup tolerates case differences and extra whitespace in captain-name input.
- Completed matches display the outcome (win/loss and set score 3-0 or 2-1) alongside the opponent information.
- The match-day highlight includes a human-readable relative time (e.g. "in 2 days") in addition to the absolute date.
- When the user's input matches no teams, the page shows a "No teams match." fallback rather than an empty list.

### May:

- Offer a "copy schedule" affordance for sharing.
- Surface division standings as a secondary view adjacent to the team's schedule.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None for v3. Playwright e2e coverage is still deferred per the MVP effort.
