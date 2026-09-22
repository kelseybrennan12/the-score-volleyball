---
name: Schedule Viewer
description: Single-page UX for a player to find their team's schedule, next game-day, record, and rank.
---

# Schedule Viewer

## Spec Metadata

- ID: P0001
- Type: Product
- Status: active
- Version: v9
- Last Updated: 2026-09-22

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

The page renders one of three view modes at a time, selected by the user via a toggle near the top of the page:

- **`team` view** (default): the existing day → league → team flow described in this spec.
- **`now` view**: a compact, read-only list of matches whose scheduled start time equals the current time, aggregated
  across every league snapshot whose league day matches today's day-of-week (in `America/Detroit`).
- **`standings` view**: a per-division standings table for any single league snapshot, selected via a flat row of
  day/division pills (`Sunday B`, `Sunday BB`, `Monday B`, …) ordered by day of week.

The active view mode is persisted in the URL as `?view=team|now|standings`. Absence of the parameter is equivalent to
`view=team`. Future view modes will extend this same parameter without changing the URL shape.

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
  - The team's division label, record (sets won / sets lost), and current rank within its division, using the same rank
    label as the Standings table so a tie reads the same in both places (e.g. "Rank 3 of 14 in BB", "Rank T-2 of 14 in
    BB", or "Unranked in BB" for a team that has not played a set).
  - The team's schedule: every scheduled match, grouped by date in chronological order. Each date is rendered as its own
    card with the matches for that day listed inside.
  - For each match: opponent's number, captain name, division, opponent's record (scoped to the opponent's division),
    time, and court.
- When a league has a single division, the division label is still shown but ranking text may omit the label.
- Teams are never ranked or compared across divisions. Teams only ever play within their division (a combined tier such
  as BB/BBB is one division with no distinction inside it), so a team's record counts every played match and its rank is
  computed against its division only. Record and rank for every team come from one Standings computation shared by Team
  detail, the Standings table, and the per-team report; ingestion records an anomaly if a schedule ever pairs teams from
  different divisions.
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
- The page remembers `{ day, leagueSlug, teamNumber }` in the browser's `localStorage` under the key
  `volleyball-viewer:selection` whenever a user action changes any of them. On mount, when the URL names none of them,
  the remembered selection is validated against the currently-shipped snapshots (stale entries — a league slug we no
  longer ingest or a team number that no longer exists — are dropped silently and the app falls back to the league that
  is live today). A non-empty selection resolved at mount is remembered; mount never clears the remembered selection.
- The page reflects the Viewer selection and Standings selection in the URL as query parameters, using a typed
  query-state library (`nuqs`). The Viewer selection covers day, league, and team; the Standings selection is
  independent and covers the Standings league and division. Parameter shapes:
  - `view`: `team` | `now` | `standings` (omitted when default `team`).
  - `day`: lowercase weekday name (`sunday`..`friday`), Team search only.
  - `league`: league slug scoping the Team search only. It no longer scopes the Standings table.
  - `team`: integer team number, Team search only.
  - `standings`: league slug naming the snapshot for the Standings table, `standings` view only.
  - `division`: division name (e.g. `B`, `BB`, `BBB`) within the Standings league, `standings` view only.
- Query-parameter and `localStorage` hydration rules. The stored shape is unchanged: `{ day, leagueSlug, teamNumber }`
  under `volleyball-viewer:selection`. Standings selection (`standings`, `division`) and `view` are URL-only and are
  never persisted.
  - The remembered selection is consulted only when the URL names none of `day`, `league`, or `team` (all-or-nothing). A
    partial URL — even just a `day` — is a deliberate link and is taken as-is; it is never merged with the remembered
    selection.
  - When the remembered selection is consulted, its values are hydrated and pushed back into the URL so the displayed
    URL is shareable.
  - On every change to `day`, `leagueSlug`, or `teamNumber`, both `localStorage` and the URL are updated.
  - The default view on first load (no URL parameter, no prior visit) is `team`.
- Validation is continuous: the displayed selection is derived from the raw parameters on every render, so a value that
  becomes stale after load (for example when the snapshot set changes) is dropped on the next render rather than
  surviving until reload. Stale values are rewritten out of the URL at mount and whenever a user action writes the URL,
  always with `history: "replace"` so the cleanup does not pollute the back-stack; a value that goes stale on a later
  render disappears from the displayed selection immediately and from the URL on the next write. The same rules apply to
  stale `localStorage` entries. Specifically:
  - `view` not in `{team, now, standings}` is treated as the default `team`.
  - `day` not in `{sunday..friday}` is treated as null; dependent `league` and `team` are also cleared.
  - `league` whose slug is not present in the current snapshot set for the resolved `day` is treated as null; dependent
    `team` is also cleared.
  - `team` that is not an integer, or whose number does not exist on the resolved league snapshot, is treated as null.
  - `standings` that does not name an active snapshot is dropped, and `division` that does not name a division present
    in that snapshot's teams is dropped; when either is invalid both are dropped so the pill row shows nothing selected.
  - Orphan children (e.g. `team` without `league`, or `league` without `day`) are cleared.
  - Cleanup is silent; no error UI is rendered.
- Transitional old-link fallback (to be removed in a later release): on mount, when `view=standings`, `standings` is
  absent, and `league` plus `division` name a valid pair, they are read as the Standings selection and the URL is
  rewritten to the new `?standings=<slug>&division=<name>` shape with `history: "replace"`. After the rewrite, `league`
  is validated as part of the Viewer selection like any other parameter.
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
- The `standings` view:
  - Renders a flat row of pills, one per `(league snapshot, division)` pair, labeled `"<Day> <Division>"` (e.g.
    `Sunday B`, `Sunday BB`, `Monday B`). Pills are ordered by canonical day-of-week (Sunday first, then Monday, …),
    with divisions sorted alphabetically inside each day.
  - Selecting a pill writes `?standings=<slug>&division=<name>` (history-replace) and renders a per-division standings
    table for that snapshot. The write never touches `day`, `league`, or `team`, so browsing standings never disturbs a
    chosen team. The table has three columns: rank, team (number + captain), and sets won–lost.
  - Ranking rule: teams are ordered by sets won descending, then sets lost ascending. Two teams sharing the same
    `(setsWon, setsLost)` share a rank using skip-method numbering and are labeled `T-N` (e.g. tied for third → both
    show `T-3`, the next team shows `5`). Tie-breakers beyond `(setsWon, setsLost)` are intentionally not modeled.
  - Teams that have not yet played a single set (record of `0-0`) appear at the bottom of the table, sorted by team
    number, with a rank label of `—` rather than a numeric rank.
  - When the rendered table contains at least one tied row, a footnote below the table explains the `T-N` marker.
  - Does not poll or auto-refresh; the user refreshes by reloading the page.
  - Below the current-season pill row and table, a collapsible **"Previous Seasons"** section is rendered whenever the
    app has at least one archived past season (`seasons/<season-key>/…` snapshots). It is collapsed by default. When
    expanded it shows: a season picker (a pill per archived season, newest-first; omitted and replaced by a static
    season label when only one season is archived) and, for the selected season, the same league/division pill row and
    per-division standings table used for the current season. Live views (team, now, current standings) never surface
    archived seasons. The Previous Seasons selection (season, league, division) is held in local component state and is
    intentionally **not** reflected in the URL or `localStorage` (unlike the current-season `?standings`/`?division`
    contract); it resets on reload.
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

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: Playwright e2e coverage is still deferred per the MVP effort.
- Implemented under:
  - [/docs/efforts/2026-04-27-01-49-now-view-and-query-params.md](/docs/efforts/2026-04-27-01-49-now-view-and-query-params.md)
    (now view + nuqs URL state).
  - [/docs/efforts/2026-05-02-13-19-standings-view.md](/docs/efforts/2026-05-02-13-19-standings-view.md) (standings
    view).
  - [/docs/efforts/2026-07-06-21-42-summer-season-cutover.md](/docs/efforts/2026-07-06-21-42-summer-season-cutover.md)
    (Previous Seasons section).
  - [/docs/efforts/2026-09-21-17-55-viewer-selection-module.md](/docs/efforts/2026-09-21-17-55-viewer-selection-module.md)
    (Viewer selection as one deep module).
  - [/docs/efforts/2026-09-22-13-09-record-and-rank-module.md](/docs/efforts/2026-09-22-13-09-record-and-rank-module.md)
    (one Record-and-Rank module; Team detail adopts the T-N tie label).
  - [/docs/efforts/2026-09-21-18-10-standings-selection-parameters.md](/docs/efforts/2026-09-21-18-10-standings-selection-parameters.md)
    (Standings selection's own `standings`/`division` parameters, independent of Team search).
