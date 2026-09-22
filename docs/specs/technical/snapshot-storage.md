---
name: Snapshot Storage
description:
  The Snapshot store, one implementation over an object-store seam with filesystem (local dev), Vercel Blob
  (production), and in-memory (tests) adapters.
---

# Snapshot Storage

## Spec Metadata

- ID: T0005
- Type: Technical
- Status: active
- Version: v3
- Last Updated: 2026-09-22

## Summary

Define where and how snapshots live. The **Snapshot store** is one module that owns the layout of live, rollback, and
season snapshots and every multi-step operation over them (archive, restore, promote, the last-ingested stamp). It sits
on an **object store** seam that only knows how to get, put, delete, and list JSON by key, with three adapters:
filesystem for local development, Vercel Blob for production, and memory for tests. The announcement uses the same
object store. This spec sits alongside
[/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md), which defines the snapshot JSON
shape itself.

## Goals

- Let the same snapshot JSON shape travel through filesystem or Blob storage without any caller-side awareness.
- Keep every rule about layout, stamps, restore, and promote in one place, so a filesystem and a Blob deployment cannot
  drift apart.
- Test the production behaviour: the operations run in tests against the memory adapter, and each adapter proves it
  satisfies the object-store contract.
- Support rollback and roll-forward by treating snapshots as strictly additive: nothing is deleted during a rollback.

## Non-Goals

- A database. Snapshots remain flat JSON objects.
- Cross-backend synchronization. Each environment uses exactly one backend at a time.
- Atomic multi-step operations. `restoreArchive` and `promoteActiveToSeason` are documented as best-effort ordered
  sequences.

## Core Concepts

- **Object store seam**: `ObjectStore` in `src/backend/runtime/adapters/object-store/port.ts`: `get(key)` returning the
  parsed JSON or `null`, `put(key, json)` overwriting, `delete(keys)` ignoring missing keys, and `list(prefix)`
  returning every stored key under the prefix in ascending order. Keys are `/`-separated and identical across backends.
- **Adapters**: `createFsObjectStore(root)` (each key is a file under `root`), `createBlobObjectStore({ token })` (each
  key is a pathname in the private Blob store), and `createMemoryObjectStore()` (a map, for tests).
- **Factory**: `resolveObjectStore()` in `src/backend/runtime/adapters/object-store/index.ts` returns the Blob adapter
  when `process.env.VERCEL === "1"` or `SNAPSHOT_STORAGE === "blob"`, and otherwise the filesystem adapter rooted at
  `data/` under the current working directory. It is the only way runtime code obtains a store; the CLI entries and the
  app both use it.
- **Snapshot store**: `createSnapshotStore(objectStore)` in `src/backend/logic/services/snapshot-store.ts`, returning
  the `SnapshotStore` interface: `readActive`, `listActive`, `writeActive`, `archiveExisting`, `listArchive`,
  `readArchive`, `restoreArchive`, `getLastIngestedAt`, `setLastIngestedAt`, and the frozen-season operations
  `listSeasonKeys`, `listSeasonSnapshots`, `writeSeasonSnapshot`, `promoteActiveToSeason`.
- **Announcement store**: `createAnnouncementStore(objectStore)` beside the announcement service, reading and writing
  the single `announcement.json` key in the same object store.

## Key Layout

The same keys on every backend. On the filesystem they are paths under `data/`; on Blob they are pathnames.

- Active: `snapshots/active/<slug>.json`.
- Rollback archive: `snapshots/archive/<slug>/<slug>-<YYYY-MM-DD-HH-MM-SS>.json`, the stamp being the archived
  snapshot's `ingestedAt` in UTC.
- Seasons: `snapshots/seasons/<season-key>/<slug>.json`, where `<season-key>` is `<session>-<year>`.
- Meta: `snapshots/meta.json` with shape `{ "lastIngestedAt": "<ISO-8601 UTC>" }`.
- Announcement: `announcement.json`.

The active and archive keys match the layout defined in
[/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md). Locally, `data/snapshots/meta.json`
and `data/announcement.json` are gitignored; the active and archive snapshots are checked in.

## Requirements

### Must:

- Every multi-step operation lives in the Snapshot store, never in an adapter. Adapters implement only the four
  object-store methods.
- Callers never construct an adapter directly at runtime; they call `resolveObjectStore()` and wrap it with
  `createSnapshotStore` or `createAnnouncementStore`.
- `resolveObjectStore()` throws at construction time if `SNAPSHOT_STORAGE === "blob"` (or `VERCEL === "1"`) but
  `BLOB_READ_WRITE_TOKEN` is missing, so misconfiguration surfaces at request time rather than at snapshot-read time.
- Write operations in the Blob adapter use `addRandomSuffix: false`, `allowOverwrite: true`, and
  `contentType: "application/json"` so that pathnames stay deterministic across runs. Reads bypass the SDK cache.
- Every location the Snapshot store returns (`writeActive`, `archiveExisting`, `RestoreResult`, `PromoteResult`) is the
  store-relative key, identical on every backend.
- `listArchive(slug, limit = 10)` returns entries newest-first, capped at the requested limit. Each entry carries
  `{ slug, archiveKey, ingestedAt }`, where `ingestedAt` is parsed from the stamp in the key on every backend; objects
  under the archive prefix whose key does not carry a stamp are ignored.
- `restoreArchive(slug, archiveKey)` executes these steps, in order:
  1. Read the archived snapshot at `archiveKey`.
  2. `archiveExisting(slug)`: copy the currently-active snapshot into the archive under its own `ingestedAt` stamp, then
     delete the active key.
  3. `writeActive(snapshot)` with the snapshot read in step 1, then delete the source archive key. The operation is
     non-atomic: if a failure occurs between steps, no snapshot is lost and the next successful ingest or rollback
     recovers a clean state.
- `getLastIngestedAt` / `setLastIngestedAt` is the authoritative rate-limit stamp. The ingestion service writes it once
  per non-dry-run run.
- The frozen-season operations:
  - `listSeasonKeys()` returns the distinct `<season-key>` segments present under `snapshots/seasons/`, sorted, or empty
    when none.
  - `listSeasonSnapshots(seasonKey)` returns every snapshot under `snapshots/seasons/<seasonKey>/`, or empty when
    absent.
  - `writeSeasonSnapshot(seasonKey, snapshot)` writes `snapshots/seasons/<seasonKey>/<slug>.json`, overwriting any
    existing object for that league, so a re-run is idempotent.
  - `promoteActiveToSeason(seasonKey, slug)` freezes a retired league: it reads the active snapshot, writes it to the
    season key, deletes the active key, and deletes every rollback entry under `snapshots/archive/<slug>/`, returning
    `{ seasonPath, deletedActive, deletedArchiveCount }`. When no active snapshot exists it is a no-op returning
    `{ seasonPath: null, deletedActive: false, deletedArchiveCount: 0 }`. The frozen copy is written before any live
    copy is deleted, so a mid-failure never loses data. It is exposed operationally through the `archive-season` CLI
    (see [/docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)).
- The repo-shipped `data/snapshots/` directory is the local development store and the default target of every CLI.
  Setting `SNAPSHOT_STORAGE=blob` with `BLOB_READ_WRITE_TOKEN` points the same CLIs at the production store. On the
  deployed app `data/` is unused; the Blob store is initially empty and populated by the first admin ingest.

### Tests:

- The Snapshot store and the announcement service are tested against the memory adapter, through their own interfaces.
- One contract test runs the same object-store cases against the filesystem adapter (in a temporary directory) and the
  memory adapter.
- The Blob adapter is tested with the `@vercel/blob` module mocked: paging past the SDK's page limit, prefix handling,
  not-found reads returning `null`, and batch delete. No test contacts the Blob service.

### Should:

- The Blob adapter sets a short `cacheControlMaxAge` (≤ 60 s) on writes so that a freshly-ingested snapshot becomes
  visible to the app without a manual cache bust.

### May:

- Add a pruning step that removes archive entries beyond the 10-entry rollback window to bound Blob usage.
- Add an import/export script to seed the Blob store from the repo filesystem (first-deploy bootstrap).

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
- Implemented under:
  - [/docs/efforts/2026-04-20-00-26-admin-ingest-tool.md](/docs/efforts/2026-04-20-00-26-admin-ingest-tool.md) (v1, port
    with two adapters).
  - [/docs/efforts/2026-07-06-21-42-summer-season-cutover.md](/docs/efforts/2026-07-06-21-42-summer-season-cutover.md)
    (v2, frozen seasons).
  - [/docs/efforts/2026-09-22-13-40-snapshot-store-seam.md](/docs/efforts/2026-09-22-13-40-snapshot-store-seam.md) (v3,
    one Snapshot store over the object-store seam).
