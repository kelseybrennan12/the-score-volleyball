---
name: Schedule Viewer
description: Single-page UX for a player to find their team's schedule, next game, record, and rank.
---

# Schedule Viewer

## Spec Metadata

- ID: P0001
- Type: Product
- Status: active
- Version: v1
- Last Updated: 2026-04-19

## Summary

Define the behavior of the single-page Next.js app that lets a league player pick their league day, identify their team,
and view their schedule, upcoming match, record, and rank.

## Goals

- Replace manual scrolling through the league spreadsheet with a focused per-team view.
- Make the next upcoming match visually prominent.
- Show each opponent's current record alongside every scheduled match.

## Non-Goals

- Authentication, accounts, or per-user preferences persisted server-side.
- In-app navigation between multiple pages or routes.
- Editing, submitting, or correcting league results from the app.
- Supporting the Thursday Women's Queen of the Beach tournament format. Only standard league spreadsheets are supported.

## Core Concepts

- **League**: A day-of-week plus session (e.g. "Spring Sundays", "Summer Tuesdays"). One snapshot per league.
- **Team**: A numbered roster (1..N) with a captain name. Teams are identified by both number and captain name.
- **Division**: A tier within a league (e.g. `B`, `BB`, `BBB` on Sundays). Some leagues have a single division, others
  split teams across several. Each team belongs to exactly one division. Record and rank are always scoped to a team's
  division.
- **Match**: One matchup between two teams at a given date, time, and court.
- **Record**: Sets-won and sets-lost, accumulated across all completed matches for a team.
- **Rank**: A team's ordinal position within its division, derived from its record.
- **Next match**: The earliest scheduled match whose calendar date is today or later. A match whose date is today is
  considered the next match regardless of its start time — this keeps matches that may be in progress highlighted rather
  than dropping off at their start time.

## Requirements

### Must:

- The app is a single page with no in-app navigation or routing away from that page.
- The app does not require authentication.
- The page presents a league-day selector covering every standard league day the ingestion pipeline has cached data for
  (Sunday through Friday, excluding the Thursday Queen of the Beach tournament).
- After a day is selected, the user sees an input that accepts either a team number or a partial/full captain name and
  matches against teams in the selected league.
- When a single team is identified, the page shows:
  - The team's number and captain name.
  - The team's division label, record (sets won / sets lost within its division), and current rank within its division
    (e.g. "3rd of 14 in BB").
  - The team's schedule: every scheduled match, in chronological order, showing the opponent's number, captain name,
    division, record (scoped to the opponent's division), and the match date, time, and court.
- When a league has a single division, the division label is still shown but ranking text may omit the label.
- Teams are never ranked or compared across divisions. A BB team's record and rank are computed from BB teams only, even
  if they are scheduled to play a BBB team inter-division (the match still appears on the schedule; the opponent's
  displayed record is scoped to the opponent's own division).
- If at least one scheduled match has a calendar date of today or later (in the league's local timezone), that next
  match is visually highlighted more prominently than the rest of the schedule. Matches whose calendar date is today are
  always eligible for the highlight even if their scheduled start time has already passed, so a match in progress
  remains visible.
- If every scheduled match has a calendar date strictly before today, no match is highlighted as the "next" match.
- The page shows the league name and the timestamp of the data snapshot currently in use so users can tell how fresh the
  data is.
- The page reads exclusively from the on-disk cached snapshots described in
  [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md). It does not fetch from Google
  Sheets at request time.
- If no snapshot exists for the selected league, the page shows an empty state explaining that no data has been ingested
  yet.

### Should:

- Team lookup tolerates case differences and extra whitespace in captain-name input.
- Completed matches display the outcome (win/loss and set score 3-0 or 2-1) alongside the opponent information.
- The next-match highlight includes a human-readable relative time (e.g. "in 2 days") in addition to the absolute date
  and time.
- When the input is ambiguous (multiple captain-name matches), the page lists the candidate teams and lets the user
  pick.

### May:

- Offer a "copy schedule" affordance for sharing.
- Surface division standings as a secondary view adjacent to the team's schedule.

## Open Questions

- None.

## Completion

- Status: Draft
- Remaining: Implementation not started.
