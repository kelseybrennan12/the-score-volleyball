---
name: Deployment
description: Target runtime, hosting model, and how ingestion snapshots reach production for the league viewer app.
---

# Deployment

## Spec Metadata

- ID: T0003
- Type: Technical
- Status: active
- Version: v1
- Last Updated: 2026-04-19

## Summary

Define the deployment target for the Schedule Viewer and how ingested data snapshots reach production. This spec is
specific to the league viewer app and supersedes the starter's
[/docs/specs/technical/delivery-pipeline.md](/docs/specs/technical/delivery-pipeline.md) for this app's production
topology.

## Goals

- Run on Vercel's Hobby tier with minimal configuration.
- Keep data access trivial and free of runtime I/O against Google Sheets.
- Keep the build reproducible from the repo alone.

## Non-Goals

- Runtime ingestion. Ingestion is an operator-triggered CLI, not a request path.
- A database, KV store, or third-party object storage for snapshot data.
- Authentication, per-user state, or server-side sessions.

## Core Concepts

- **Build-time data**: snapshot JSON files ship with the Vercel build because they live in the repo at
  `data/snapshots/active/`.
- **Ingest-then-commit workflow**: the operator runs the ingestion CLI locally, reviews diffs, commits the resulting
  snapshot changes, and pushes. Vercel redeploys with the refreshed data.

## Requirements

### Must:

- The app is a Next.js project deployed on a Vercel Hobby account.
- The production build has no dependency on filesystem writes at runtime. The Vercel runtime filesystem is treated as
  read-only.
- Snapshot JSON under `data/snapshots/` is checked into the repo. The Next.js app reads snapshots from the bundled
  filesystem at runtime (via `fs` in a server component or route handler) or by importing them at build time.
- Data refresh reaches production via the Git push workflow: operator runs ingestion locally, commits updated snapshots,
  pushes to the main branch, Vercel redeploys automatically.
- The ingestion CLI remains independent of Vercel. It runs anywhere the repo is checked out with the project's Node
  toolchain.

### Should:

- The ingestion command's core functions are structured so the same logic can later be invoked from a Next.js route
  handler (see [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)). If
  migrated, a route-handler invocation would need to write snapshots to an external store rather than the repo
  filesystem, since Vercel's runtime filesystem is ephemeral and read-only outside `/tmp`.
- Documentation for the snapshot-refresh workflow lives alongside developer commands so operators can find it without
  reading specs end-to-end.

### May:

- Add a Vercel cron-triggered route handler in a future iteration once a persistence target (blob store, external DB) is
  chosen for server-side ingestion output.

## Open Questions

- None.

## Completion

- Status: Draft
- Remaining: Implementation not started.
