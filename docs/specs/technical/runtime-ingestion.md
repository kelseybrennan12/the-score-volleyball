---
name: Runtime Ingestion
description: HTTP route handler that runs the ingestion pipeline from the deployed app, gated by an admin session.
---

# Runtime Ingestion

## Spec Metadata

- ID: T0004
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-05-02

## Summary

Define the runtime-ingestion topology: the Next.js route handler that invokes the shared ingestion core, the admin
session that gates it, and the rate limit that protects it from abuse. Related specs:
[/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) (UX),
[/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md) (storage backend),
[/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) (parsing core).

## Goals

- Reuse the existing fetch/parse/write core unchanged for both CLI and HTTP invocations.
- Keep ingestion callable from a phone browser on the deployed app without introducing a separate service.
- Prevent casual abuse via a server-side rate limit on the ingest action.

## Non-Goals

- Per-league endpoints or a streaming progress API. The route handler returns a single JSON result when the run
  finishes.
- External auth providers. A single shared passphrase is sufficient for the current operator model.
- Per-day-of-week or sub-hourly cron schedules. One daily fire is sufficient on Vercel Hobby and matches the operator
  cadence; the manual admin route is still available for ad-hoc refreshes.

## Core Concepts

- **Shared ingestion service**: `runIngestion({ sources, fetcher, repo, dryRun, now })` in
  `src/backend/logic/services/run-ingestion.ts`. Used by both the CLI entrypoint and the route handler.
- **Admin session**: an HMAC-signed cookie (`admin_session`) of the form `<issuedAtMs>.<hex-hmac>`, signed with
  `ADMIN_COOKIE_SECRET`. See [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) for the UX-facing
  lifecycle.
- **Rate limit stamp**: the snapshot repo's `getLastIngestedAt` / `setLastIngestedAt` pair, backed by a `meta.json`
  object in the active storage backend.

## Requirements

### Must:

- A Next.js route handler `POST /api/admin/ingest` exists and runs in the Node runtime. Its request path is:
  - Verify a valid admin session cookie (reject with 401 otherwise).
  - Verify environment configuration is present (`ADMIN_PASSPHRASE`, `ADMIN_COOKIE_SECRET`; reject with 503 otherwise).
  - Read `repo.getLastIngestedAt()`; if the elapsed time is less than the cooldown window, respond 429 with a
    `retryAfterSeconds` field and the `Retry-After` header.
  - Otherwise call `runIngestion({ sources: LEAGUE_SOURCES, fetcher, repo })` and respond with the per-league result
    array and the new `lastIngestedAt`.
- A Next.js route handler `POST /api/admin/session` accepts `{ passphrase: string }`, compares it against
  `ADMIN_PASSPHRASE` via a constant-time comparison, and on success sets the `admin_session` cookie. It rejects with 401
  on mismatch and 503 when configuration is missing.
- A Next.js route handler `DELETE /api/admin/session` clears the cookie by setting `Max-Age=0`.
- A Next.js route handler `GET /api/admin/rollbacks` returns the list of cached leagues and, per league, up to the 10
  most recent archive entries (newest-first) plus the active snapshot's `ingestedAt`. The response also includes the
  overall `lastIngestedAt`.
- A Next.js route handler `POST /api/admin/rollback` accepts `{ slug: string, archiveKey: string }`, validates both
  inputs against a safe character set, and calls `repo.restoreArchive(slug, archiveKey)`. The handler does not invoke
  the ingest path and is not subject to the ingest rate limit.
- The ingest cooldown window is 5 minutes. `setLastIngestedAt(ranAt)` is called by the service whenever a non-dry-run
  ingestion completes, even if some leagues failed, so partial successes still extend the cooldown.
- All admin route handlers set `runtime = "nodejs"` and `dynamic = "force-dynamic"` to prevent caching or Edge-runtime
  mismatch. The ingest handler additionally exports `maxDuration = 60` to accommodate a full multi-league run within
  Vercel's function timeout.
- A second Next.js route handler `GET /api/cron/ingest` exists for Vercel Cron. Its request path is:
  - Reject with 503 if `CRON_SECRET` is not configured.
  - Verify the request's `Authorization` header equals `Bearer ${CRON_SECRET}` using a constant-time comparison; reject
    with 401 otherwise.
  - Read `repo.getLastIngestedAt()`; if elapsed is less than the same `INGEST_COOLDOWN_MS` window the admin route uses,
    respond `200 { ok: true, skipped: true, reason: "cooldown", lastIngestedAt }`. Cron skips do not return non-2xx
    because Vercel surfaces non-2xx as cron failures and a benign cooldown collision should not alert the operator.
  - Otherwise call the same `runIngestion` core and respond `200 { ok: true, lastIngestedAt, results }`. Per-league
    failures stay inside the result array (parity with the admin route); only an unexpected pipeline exception returns
    `500`.
- The cron route uses the same `runtime = "nodejs"`, `dynamic = "force-dynamic"`, and `maxDuration = 60` exports as the
  admin route. The shared `INGEST_COOLDOWN_MS` constant lives in
  [/src/backend/logic/services/runtime-ingestion-config.ts](/src/backend/logic/services/runtime-ingestion-config.ts) so
  both routes stay in lockstep.
- The cron schedule itself lives in [/vercel.json](/vercel.json) at `/api/cron/ingest` on `0 8 * * *` UTC (04:00 ET in
  EDT, 03:00 ET in EST).

### Should:

- The ingest handler returns per-league anomaly notes so the admin UI can surface them without a separate request.
- The service is structured so a future `POST /api/admin/ingest` variant for a single league is an adapter around
  `runIngestion` with a filtered `sources` array, with no changes to the core.

### May:

- Add a `pending=true` flag in `meta.json` to guard against concurrent ingest submissions within the same cooldown
  window. Not required for the current single-operator model.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
