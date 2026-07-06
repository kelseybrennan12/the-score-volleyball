---
name: Snapshot Storage
description: Storage-backend port for snapshots, with filesystem (local dev) and Vercel Blob (production) adapters.
---

# Snapshot Storage

## Spec Metadata

- ID: T0005
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-07-06

## Summary

Define the snapshot-storage port that both the CLI and the deployed Next.js app consume, along with the two concrete
adapters (filesystem for local dev, Vercel Blob for production) and the environment-driven selection rule. This spec
sits alongside [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md), which defines the
snapshot JSON shape itself; this spec defines _where and how_ those JSON blobs live.

## Goals

- Let the same snapshot JSON shape travel through filesystem or Blob storage without any caller-side awareness.
- Preserve the active-vs-archive layout conceptually across backends.
- Support rollback and roll-forward by treating snapshots as strictly additive: nothing is deleted during a rollback.

## Non-Goals

- A database. Snapshots remain flat blobs.
- Cross-backend synchronization. Each environment uses exactly one backend at a time.
- Atomic multi-step operations. `restoreArchive` is documented as a best-effort three-step sequence.

## Core Concepts

- **Port**: `SnapshotRepo` in `src/backend/runtime/adapters/snapshots/port.ts`, exposing `readActive`, `listActive`,
  `writeActive`, `archiveExisting`, `listArchive`, `readArchive`, `restoreArchive`, `getLastIngestedAt`,
  `setLastIngestedAt`, and the frozen-season methods `listSeasonKeys`, `listSeasonSnapshots`, `writeSeasonSnapshot`, and
  `promoteActiveToSeason`.
- **Filesystem adapter**: `createSnapshotRepo(root)` — writes under `data/snapshots/active/`, `data/snapshots/archive/`,
  and `data/snapshots/meta.json`. Used by local development and the ingestion CLI.
- **Blob adapter**: `createBlobSnapshotRepo({ token })` — backed by `@vercel/blob`. Writes under the same logical layout
  (`snapshots/active/`, `snapshots/archive/`, `snapshots/meta.json`) inside the Vercel Blob store associated with
  `BLOB_READ_WRITE_TOKEN`.
- **Factory**: `resolveSnapshotRepo()` returns the Blob adapter when `process.env.VERCEL === "1"` or when
  `SNAPSHOT_STORAGE === "blob"`, and otherwise returns the filesystem adapter rooted at `data/snapshots/`.

## On-Disk / On-Blob Layout

- Active: `<root>/active/<slug>.json` (filesystem) or `snapshots/active/<slug>.json` (Blob).
- Archive: `<root>/archive/<slug>/<slug>-<YYYY-MM-DD-HH-MM-SS>.json` (filesystem) or
  `snapshots/archive/<slug>/<slug>-<YYYY-MM-DD-HH-MM-SS>.json` (Blob).
- Seasons: `<root>/seasons/<season-key>/<slug>.json` (filesystem) or `snapshots/seasons/<season-key>/<slug>.json`
  (Blob), where `<season-key>` is `<session>-<year>`.
- Meta: `<root>/meta.json` (filesystem) or `snapshots/meta.json` (Blob). Shape:
  `{ "lastIngestedAt": "<ISO-8601 UTC>" }`.

The active and archive paths match the layout defined in
[/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md); this spec only adds the `meta.json`
location.

## Requirements

### Must:

- Both adapters implement the full `SnapshotRepo` port. Callers never import from a concrete adapter directly at runtime
  — they call `resolveSnapshotRepo()`.
- Write operations in the Blob adapter use `addRandomSuffix: false`, `allowOverwrite: true`, and
  `contentType: "application/json"` so that pathnames stay deterministic and predictable across runs.
- The filesystem adapter is rooted at `data/snapshots/` (relative to `process.cwd()`) by default; the factory passes the
  current working directory in. The CLI and Next.js app both honor this default.
- `resolveSnapshotRepo()` throws at construction time if `SNAPSHOT_STORAGE === "blob"` (or `VERCEL === "1"`) but
  `BLOB_READ_WRITE_TOKEN` is missing. This surfaces misconfiguration at request time rather than at snapshot-read time.
- `listArchive(slug, limit = 10)` returns entries newest-first, capped at the requested limit (default 10). Each entry
  carries `{ slug, archiveKey, ingestedAt }`. The Blob adapter derives `ingestedAt` by parsing the archive filename's
  timestamp; the filesystem adapter reads the underlying JSON to get `ingestedAt`.
- `restoreArchive(slug, archiveKey)` executes these three steps, in order:
  1. Read the archived snapshot at `archiveKey`.
  2. Call `archiveExisting(slug)` to move the currently-active snapshot into the archive folder under its own
     `ingestedAt` stamp.
  3. `writeActive(snapshot)` with the snapshot read in step 1, then delete the source archive entry. The operation is
     documented as non-atomic: if a failure occurs between steps, no snapshot is lost and the next successful ingest or
     rollback recovers a clean state.
- `getLastIngestedAt` / `setLastIngestedAt` is the authoritative rate-limit stamp. The ingestion service writes it once
  per non-dry-run run.
- The frozen-season methods behave uniformly across both adapters:
  - `listSeasonKeys()` returns the distinct `<season-key>` directories present under `seasons/` (empty when none).
  - `listSeasonSnapshots(seasonKey)` returns every snapshot under `seasons/<seasonKey>/` (empty when absent).
  - `writeSeasonSnapshot(seasonKey, snapshot)` writes `seasons/<seasonKey>/<snapshot.league.slug>.json`, overwriting any
    existing file for that league (so a re-run is idempotent).
  - `promoteActiveToSeason(seasonKey, slug)` freezes a retired league: it reads `active/<slug>.json`, writes it to
    `seasons/<seasonKey>/<slug>.json`, deletes `active/<slug>.json`, and deletes every rollback entry under
    `archive/<slug>/`, returning `{ seasonPath, deletedActive, deletedArchiveCount }`. When no active snapshot exists it
    is a no-op returning `{ seasonPath: null, deletedActive: false, deletedArchiveCount: 0 }`. Like `restoreArchive`,
    the sequence is non-atomic but ordered so the frozen copy is written before any live copy is deleted; a mid-failure
    never loses data. The operation is exposed operationally through the `archive-season` CLI (see
    [/docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)).
- The repo-shipped `data/snapshots/` directory is still used for local development and remains the source of truth for
  the CLI. On the deployed app it is unused; the Blob store is initially empty and populated by the first admin ingest.

### Should:

- The Blob adapter sets a short `cacheControlMaxAge` (≤ 60 s) on snapshot writes so that a freshly-ingested snapshot
  becomes visible to the app without a manual cache bust.
- Adapter-level tests live under `src/tests/unit/` and exercise the full port surface, so semantics stay consistent
  between filesystem and Blob.

### May:

- Add a pruning step that removes archive entries beyond the 10-entry rollback window to bound Blob usage.
- Add an import/export script to seed the Blob store from the repo filesystem (first-deploy bootstrap).

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
