---
name: Schedule Viewer
description: Single-page UX for a player to find their team's schedule, next game-day, record, and rank.
---

# Schedule Viewer

## Spec Metadata

- ID: P0001
- Type: Product
- Status: active
- Version: v5
- Last Updated: 2026-04-26

## Summary

Define the behavior of the single-page Next.js app that lets a league player pick their league day, identify their team,
and view their schedule, upcoming match day, record, and rank.

## Goals

- Replace manual scrolling through the league spreadsheet with a focused per-team view.
- Make the next upcoming match day visually prominent.
- Show each opponent's current record alongside every scheduled match.
- Remember the user's last selection so reopening the app lands them back on the same team.
- Offer a quick at-the-courts "what's playing right now" view so a spectator can identify currently-running matches
  across courts without first locating a team.
- Make views and selections shareable by URL while preserving the existing per-device "remember my last team" behavior.

## Non-Goals

- Authentication, accounts, or per-user preferences persisted server-side.
- In-app navigation between multiple pages or routes. (View modes are query-parameter-driven on the same single page;
  they are not separate routes.)
- Editing, submitting, or correcting league results from the app.
- Supporting the Thursday Women's Queen of the Beach tournament format. Only standard league spreadsheets are supported.
- A full season-wide schedule browser (every court / every team / every date). The `now` view scaffolds the query-param
  view-mode model that a future `schedule` view will reuse, but the schedule browser itself is a future spec increment.
- Auto-refreshing the `now` view in the background. The user re-renders by reloading the page or interacting with the
  app; periodic polling is not in scope.

## View Modes

The page renders one of two view modes at a time, selected by the user via a toggle near the top of the page:

- **`team` view** (default): the existing day → league → team flow described in this spec.
- **`now` view**: a compact, read-only list of matches whose scheduled start time equals the current time, aggregated
  across every league snapshot whose league day matches today's day-of-week (in `America/Detroit`).

The active view mode is persisted in the URL as `?view=team|now`. Absence of the parameter is equivalent to `view=team`.
Future view modes (e.g. a season-wide `schedule` browser) will extend this same parameter without changing the URL
shape.

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
- The page also reflects `{ view, day, leagueSlug, teamNumber }` in the URL as query parameters, using a typed
  query-state library (`nuqs`). Parameter shapes:
  - `view`: `team` | `now` (omitted when default `team`).
  - `day`: lowercase weekday name (`sunday`..`friday`), only meaningful in `team` view.
  - `league`: league slug, only meaningful in `team` view.
  - `team`: integer team number, only meaningful in `team` view.
- Query-parameter and `localStorage` hydration rules:
  - On mount, if a query parameter is present, it wins over the corresponding `localStorage` value.
  - On mount, if a query parameter is absent, the corresponding value is hydrated from `localStorage` and pushed back
    into the URL so the displayed URL is shareable.
  - On every change to `day`, `leagueSlug`, or `teamNumber`, both `localStorage` and the URL are updated.
  - The `view` parameter is URL-only; it is not persisted in `localStorage`. The default view on first load (no URL
    parameter, no prior visit) is `team`.
  - Invalid or stale URL values are silently dropped and the URL is rewritten without them, using `history: "replace"`
    so the cleanup does not pollute the back-stack. The same rules apply to invalid `localStorage` entries.
    Specifically:
    - `view` not in `{team, now}` is treated as the default `team`.
    - `day` not in `{sunday..friday}` is treated as null; dependent `league` and `team` are also cleared.
    - `league` whose slug is not present in the current snapshot set for the resolved `day` is treated as null;
      dependent `team` is also cleared.
    - `team` that is not an integer, or whose number does not exist on the resolved league snapshot, is treated as null.
    - Orphan children (e.g. `team` without `league`, or `league` without `day`) are cleared.
    - Cleanup is silent; no error UI is rendered.
- The search query text is not persisted in either `localStorage` or the URL.
- The `now` view:
  - Renders independently of the user's selected day, league, or team. It always reflects the current real-world moment.
  - Aggregates matches from every active snapshot whose `league.day` equals today's day-of-week in `America/Detroit`.
  - Includes a match if and only if the match has already started and the elapsed time since its scheduled start is less
    than `NOW_WINDOW_MINUTES` (a single tunable constant, default `50` — the slot length between consecutive league
    matches). Future-dated matches are never included; the moment the next slot begins, the previous slot's matches drop
    out and the new slot's matches appear. Widening or narrowing the window must remain a one-line change.
  - For each included match shows: court, time, division pill, and both team numbers (`#A vs #B`). Captain names and
    opponent records are not shown in this compact view.
  - Groups matches by court for at-a-glance scanning. Within a court, matches are ordered by start time.
  - When no matches are currently playing under the configured window, displays an empty-state message naming the next
    upcoming start time today (if any) so the spectator knows when to check back. If no league plays today at all,
    displays a different empty state pointing the user toward the `team` view.
  - Does not poll or auto-refresh; the user refreshes by reloading the page.
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
- Remaining: `now` view (v5) and the `nuqs`-driven URL state model are pending implementation under the effort
  [/docs/efforts/2026-04-27-01-49-now-view-and-query-params.md](/docs/efforts/2026-04-27-01-49-now-view-and-query-params.md).
  Playwright e2e coverage is still deferred per the MVP effort.
