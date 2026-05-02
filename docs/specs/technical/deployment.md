---
name: Deployment
description: Target runtime, hosting model, and how ingestion snapshots reach production for the league viewer app.
---

# Deployment

## Spec Metadata

- ID: T0003
- Type: Technical
- Status: active
- Version: v3
- Last Updated: 2026-05-02

## Summary

Define the deployment target for the Schedule Viewer and how ingested data snapshots reach production. This spec is
specific to the league viewer app and supersedes the starter's
[/docs/specs/technical/delivery-pipeline.md](/docs/specs/technical/delivery-pipeline.md) for this app's production
topology.

## Goals

- Run on Vercel's Hobby tier with minimal configuration.
- Keep data access trivial and free of runtime I/O against Google Sheets on the viewer request path.
- Support operator-triggered runtime ingestion from the deployed app so refreshes don't require a local checkout.
- Refresh snapshots automatically once a day via Vercel Cron, so most users see same-day data without an operator
  manually triggering an ingest.

## Non-Goals

- A database or SQL store for snapshot data.
- Per-user accounts or general authentication. The admin tool uses a single shared passphrase.

## Core Concepts

- **Dual storage backends**: Vercel Blob in production (runtime-writeable), filesystem in local dev. Selected by the
  factory in [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md).
- **Runtime ingestion**: operator triggers an ingest from the hidden admin tool; the route handler runs the shared
  ingestion core and writes updated snapshots to Blob. See
  [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md) and
  [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md).
- **CLI fallback**: `mise run ingest` still works locally against the filesystem adapter for development and as a
  disaster-recovery escape hatch.

## Requirements

### Must:

- The app is a Next.js project deployed on a Vercel Hobby account.
- In production, snapshot reads and writes go through Vercel Blob (`@vercel/blob`) via the Blob adapter. The Vercel
  runtime filesystem remains read-only for the app; no snapshot file writes occur on the local function filesystem.
- In local development and CI, snapshot reads and writes go through the filesystem adapter rooted at `data/snapshots/`.
  The selection is environment-driven (see
  [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md)).
- The deployment exposes a hidden admin tool (see
  [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md)) as the primary refresh path in production. The
  tool is gated by a shared passphrase and a signed session cookie.
- Environment variables required for the admin tool, Blob storage, and the cron ingest are documented in `.env.example`:
  `ADMIN_PASSPHRASE`, `ADMIN_COOKIE_SECRET`, `CRON_SECRET`, and (auto-injected on Vercel) `BLOB_READ_WRITE_TOKEN`.
- The deployment includes a Vercel Cron entry in [/vercel.json](/vercel.json) that hits `/api/cron/ingest` on
  `0 8 * * *` UTC (daily, 04:00 ET in EDT / 03:00 ET in EST). Vercel Cron auto-attaches
  `Authorization: Bearer ${CRON_SECRET}` to the outbound request; the route validates the bearer before running
  ingestion.
- The ingestion CLI remains independent of Vercel. It runs anywhere the repo is checked out with the project's Node
  toolchain and writes to the local filesystem, unaffected by the Blob adapter.

### Should:

- First-deploy bootstrap is documented: on a fresh Vercel project, the Blob store starts empty; the operator opens the
  admin tool and runs an initial ingest to populate it. The main viewer renders its empty state until that first ingest
  completes.
- The ingest-then-commit workflow is preserved as a documented fallback for cases where the admin tool is unavailable
  (e.g. Blob outage or missing env vars), but the admin tool is the documented primary path.

### May:

- Add per-day-of-week scheduling once Vercel plan tiers (or another scheduler) make it free.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None for v3.
