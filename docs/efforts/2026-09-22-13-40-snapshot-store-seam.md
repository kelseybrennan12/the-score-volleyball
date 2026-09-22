# Effort

- Name: One Snapshot store over an object-store seam
- Date: 2026-09-22
- Time: 13:40
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-22 13:38 UTC

## Scope

Candidate 2 of the 2026-09-22 architecture review. The snapshot storage port had 13 methods and two adapters that each
re-implemented the multi-step operations (archive, restore, promote); the production Blob adapter had no tests, and the
two adapters already disagreed on how to list the rollback archive.

In scope:

- A four-method object-store seam
  ([src/backend/runtime/adapters/object-store/port.ts](/src/backend/runtime/adapters/object-store/port.ts)) with
  filesystem, Vercel Blob, and memory adapters, and one `resolveObjectStore()` factory.
- One Snapshot store ([src/backend/logic/services/snapshot-store.ts](/src/backend/logic/services/snapshot-store.ts))
  that owns the key layout, archive stamps, restore, promote, seasons, and the last-ingested stamp.
- One key layout on every backend, with the filesystem store rooted at `data/`. The local announcement file moves to
  `data/announcement.json` (gitignored).
- `createAnnouncementStore(objectStore)` beside the announcement service; the four announcement adapter files are gone.
- The ingest and report CLIs use the factory, so `SNAPSHOT_STORAGE=blob` works from the command line.
- Spec T0005 rewritten to v3.

Out of scope: the other review candidates.

## Spec Set (Frozen)

- [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md) (v3)
- [/docs/specs/technical/deployment.md](/docs/specs/technical/deployment.md)
- [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md)
- [/CONTEXT.md](/CONTEXT.md)

## Spec Coverage Checklist

- [x] Adapters implement only `get`, `put`, `delete`, `list`; every multi-step operation lives in the Snapshot store.
- [x] Keys are identical across backends; every returned location is a store-relative key.
- [x] `listArchive` reads `ingestedAt` from the key stamp on every backend and ignores unstamped objects.
- [x] `restoreArchive` and `promoteActiveToSeason` keep their documented step order and results.
- [x] `resolveObjectStore()` is the only runtime construction path; the CLIs use it; no concrete re-exports remain.
- [x] The announcement reads and writes `announcement.json` in the same object store.
- [x] Snapshot store, run-ingestion, cron, and announcement tests run against the memory adapter.
- [x] A contract test runs the object-store cases against filesystem and memory.
- [x] The Blob adapter is tested with `@vercel/blob` mocked (paging, prefix, not-found, batch delete); nothing contacts
      the network.
- [x] Typecheck, lint, format check, and the full unit suite pass.

## Plan

1. TDD the object-store contract against memory, then add the filesystem adapter to the same matrix.
2. TDD the Snapshot store against memory, porting the three former fs-adapter test files and adding the key-stamp
   listing rule.
3. TDD the Blob adapter with `vi.mock("@vercel/blob")`.
4. Port the announcement tests; add `createAnnouncementStore`.
5. Add the factory, delete `adapters/snapshots`, `adapters/announcements`, and `storage-backend.ts`; rewire the page,
   the five API routes, the three CLI entries, and the two ingestion services (input field renamed `repo` → `store`).
6. Rewrite spec T0005; touch deployment, runtime-ingestion, spreadsheet-ingestion, the technical README, AGENTS.md, and
   `.gitignore`.

## Execution Notes

- Plan approved in chat during the grilling session that followed the architecture review; Kelsey chose module mocking
  over an injected SDK client for the Blob adapter tests, and asked for a pull request rather than a push to main.
- The filesystem adapter walks from the deepest directory a prefix names, so partial-name prefixes work the same as on
  Blob.
- Gates: `pnpm run typecheck`, `pnpm run lint`, `pnpm run fmt-check`, `pnpm run test` (203 tests) pass. The viewer and
  Standings pages were checked in the browser against the checked-in `data/` store.

## Deviations

- Rollback-archive entries now report `ingestedAt` at second precision (parsed from the key) on the filesystem backend,
  where they previously carried the archived file's millisecond value. The admin page only displays that value.
- The `RunIngestionInput` and `CronIngestInput` field is `store`, not `repo`, to match the `SnapshotStore` name.

## Status

Done
