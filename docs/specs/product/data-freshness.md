---
name: Data Freshness
description: How snapshot age and season identity are surfaced to users of the Schedule Viewer.
---

# Data Freshness

## Spec Metadata

- ID: P0002
- Type: Product
- Status: active
- Version: v2
- Last Updated: 2026-04-19

## Summary

Define what the app tells users about the age, origin, and season identity of the league data they are viewing.

## Goals

- Make it obvious which league session (Spring/Summer/Fall and year) the data belongs to.
- Make the ingestion timestamp discoverable so users know whether recently-played results would be reflected.
- Prevent confusion when a spreadsheet has been reused for a new season but not yet re-ingested.

## Context

The league admins do not update the underlying spreadsheets frequently, so most of the time the snapshot will
legitimately be several days old. The app's role is to make the snapshot age discoverable, not to raise an alarm about
it.

## Non-Goals

- Automatic background refresh. Ingestion is explicitly operator-triggered per
  [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md).
- Surfacing per-cell provenance or change history.

## Requirements

### Must:

- The page displays, for the currently selected league: the league name, the session label (e.g. "Spring Sundays 2026"),
  and the snapshot timestamp in the user's local timezone.
- The snapshot timestamp reflects the moment the underlying spreadsheet was ingested, not the moment the page was
  loaded.
- When no snapshot exists for the selected league, the page shows an empty state rather than an error.
- The app does not render a staleness warning, threshold-based badge, or alarm based on snapshot age. Showing the
  ingestion timestamp is sufficient; interpretation is left to the user.
- The page renders a footer link to the source standings page
  (`https://www.thescoregr.com/volleyball/beach-volleyball-leagues/`) so users can cross-reference the authoritative
  spreadsheet when they want to double-check the displayed data.

### Should:

- The session label is derived from the snapshot content (the `league.session` and `league.year` fields in the JSON
  snapshot) rather than from the filename alone.
- The snapshot timestamp is presented in a human-readable format (e.g. "April 19, 2026 at 2:05 PM") alongside a
  relative-time hint (e.g. "3 days ago").

### May:

- Offer a "view archived snapshots" affordance that lets a user switch to an older cached snapshot for the same league.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
