---
name: Admin Tool
description: Hidden admin entry, passphrase gate, and operator-facing ingest + rollback UI for the Schedule Viewer.
---

# Admin Tool

## Spec Metadata

- ID: P0003
- Type: Product
- Status: active
- Version: v2
- Last Updated: 2026-04-20

## Summary

Define the behavior of the hidden admin tool that lets the operator refresh league snapshots and roll back to a prior
snapshot from the deployed app, without a local checkout.

## Goals

- Refresh production data from a phone browser in seconds, without pushing to git.
- Recover from a bad ingest by rolling back to a recent snapshot.
- Keep the admin surface invisible to normal users — no discoverable links, no visible affordances on the main viewer.

## Non-Goals

- Multi-user admin access or per-user accounts.
- Audit logging beyond the last-successful-ingest timestamp.
- Editing snapshot contents or individual matches through the UI.
- Discovering the admin page via sitemap or navigation.

## Core Concepts

- **Hidden entry gesture**: triple-tapping the page title on the main viewer within 600 ms opens a passphrase modal.
- **Passphrase gate**: a single shared passphrase, checked server-side, establishes an admin session.
- **Admin session**: a non-persistent, signed cookie that clears when the browser tab/window closes and is hard-capped
  server-side at 4 hours.
- **Admin page**: `/admin` — exposes the ingest trigger, last-successful-ingest timestamp, and a rollback list per
  league.

## Requirements

### Must:

- The main viewer renders no visible admin affordance. The only entry point is triple-tapping the page title within a
  600 ms window.
- Successful gesture opens a modal requesting the admin passphrase. Submitting the correct passphrase establishes an
  admin session and navigates to `/admin`; incorrect submissions show an inline error and do not set a session.
- The admin session cookie is `HttpOnly`, `SameSite=Strict`, `Secure` in production, has no `Expires`/`Max-Age` so it
  clears on tab close, and is additionally rejected by the server if older than 4 hours.
- `/admin` is reachable only with a valid admin session cookie. Unauthorized access redirects to `/`.
- `/admin` shows:
  - An "Ingest now" action that triggers a refresh of all cached leagues.
  - The timestamp of the last successful ingest.
  - For each league with an active snapshot, a list of up to the 10 most recent archived snapshots, ordered
    newest-first, each showing the ingestion timestamp and a "Restore" action.
- Invoking "Ingest now" within 5 minutes of the last successful ingest is rejected with a user-visible message
  indicating the remaining wait time. The rate limit is enforced server-side.
- After each ingest attempt, the admin page renders a per-league result block listing: league slug, ok/failed status,
  team and match counts, roster-diff state, and any parser/validation anomalies returned by the server. Anomalies are
  presented as warnings (distinct from `failed` state) so an ingest that succeeds with anomalies does not render as a
  failure.
- Invoking "Restore" on an archive entry promotes that snapshot to the active slot, archives the snapshot it replaced,
  and refreshes the admin view. Rollbacks are not rate-limited.
- A rollback preserves the previously-active snapshot as the newest archive entry so the operator can immediately roll
  forward.
- If the admin environment configuration (shared passphrase, cookie signing secret) is missing, the admin endpoints
  respond with HTTP 503 and the admin page shows a configuration-required empty state.

### Should:

- The admin page offers an explicit "Sign out" affordance that clears the session cookie.

### May:

- Cache the admin page's rollback list briefly to avoid re-listing archives on every render.
- Add additional hidden gestures (e.g. long-press) as alternative entry points.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
