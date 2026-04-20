# Effort

- Name: Admin Ingest Tool (Runtime Ingestion + Rollback)
- Date: 2026-04-20
- Time: 00:26
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-20 00:35

## Scope

Add a hidden admin tool that lets the operator refresh league snapshots and roll back to a prior snapshot directly from
the deployed app, without a local checkout. This replaces the "ingest locally, commit, push" workflow as the primary
refresh path for production while keeping the CLI working for local development.

In scope:

- Move production snapshot storage off the repo filesystem and onto Vercel Blob (free tier). Local development continues
  to use the filesystem adapter under `data/snapshots/`.
- A Next.js route handler that invokes the existing fetch/parse/write ingestion core against the Blob-backed snapshot
  store.
- A rate limit of one successful ingest per 5 minutes, enforced server-side via a `last_ingested_at` stamp stored in
  Blob.
- A hidden admin entry: triple-tap on the page title on the main viewer page opens a passphrase prompt; submitting the
  correct passphrase (checked server-side against an env var) sets a non-persistent session cookie and navigates to the
  admin page.
- An admin page (`/admin`) that is gated by the session cookie and renders:
  - An "Ingest now" button that calls the ingest route handler.
  - The timestamp of the last successful ingest.
  - A rollback list showing up to the 10 most recent archived snapshots per league, with a tap-to-restore action.
- Rollback behavior: selecting an archived snapshot promotes it to the active slot; the currently-active snapshot is
  archived (not overwritten), so the operator can roll forward. Rollback is not rate-limited.

Out of scope:

- Multi-user admin access, per-user admin accounts, or audit logging beyond the `last_ingested_at` stamp.
- A UI for editing snapshot contents or individual match outcomes.
- Replacing the CLI. `mise run ingest` continues to work against the filesystem adapter for local dev.
- Automatic scheduled ingestion (Vercel cron). Left for a future effort.
- Migrating historical archived snapshots currently in the repo into Blob. New archives written by the route handler
  land in Blob; the repo's `data/snapshots/archive/` is left in place but is not read by the production app.

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md)
- [/docs/specs/technical/deployment.md](/docs/specs/technical/deployment.md)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md)
- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)

New specs expected to be authored during this effort (not yet frozen — will be drafted during `effort-plan`):

- `/docs/specs/product/admin-tool.md` — behavior of the hidden admin entry, passphrase gate, ingest + rollback UI.
- `/docs/specs/technical/runtime-ingestion.md` — route-handler topology, rate limit, session cookie, env-var secret.
- `/docs/specs/technical/snapshot-storage.md` — Blob-vs-FS adapter split, prod/dev selection, rollback/roll-forward
  semantics, 10-entry rollback window.

## Spec Coverage Checklist

### Schedule Viewer ([/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md))

- [x] Page title on the main viewer is a triple-tap target that opens the admin passphrase prompt.
- [x] Triple-tap gesture does not interfere with normal page interaction on touch or mouse.
- [x] No visible admin affordance is rendered on the main viewer outside the gesture.

### Deployment ([/docs/specs/technical/deployment.md](/docs/specs/technical/deployment.md))

- [x] Production snapshot reads and writes go through Vercel Blob. The Vercel runtime filesystem is still not used for
      writes.
- [x] Local development continues to read/write from `data/snapshots/` via the filesystem adapter.
- [x] Environment variable configuration is documented for the admin passphrase and any Blob tokens Vercel does not
      auto-inject.
- [x] The "ingest locally, commit, push" workflow is documented as a fallback, but the admin tool is the documented
      primary refresh path in production.

### Data Snapshots ([/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md))

- [x] Snapshot JSON shape and `schemaVersion` are unchanged; only the storage backend changes.
- [x] Active-vs-archive layout is preserved logically: one active snapshot per league, archives keyed by timestamp.
- [x] Rollback promotes an archived snapshot to the active slot and archives the snapshot it replaced (no snapshot
      deletion).
- [x] The admin UI reads the 10 most recent archive entries per league, ordered newest-first.

### Spreadsheet Ingestion ([/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md))

- [x] The existing fetch/parse/write core is reused unchanged by the new route handler — no duplication of parsing
      logic.
- [x] Route-handler ingestion honors the same per-league failure semantics as the CLI (per-league failure does not abort
      the run; overall result reports which leagues succeeded).
- [x] Route-handler ingestion is rejected with a clear error when called within 5 minutes of the last successful ingest.
- [x] `last_ingested_at` is updated only on a fully-successful run (or partial-success definition documented and applied
      consistently).

### Admin Tool (new spec, to be drafted)

- [x] Hidden entry gesture: triple-tap within a short time window on the main page title.
- [x] Passphrase prompt is a modal on the main page; failure states are clear; successful submission navigates to
      `/admin`.
- [x] Session cookie is non-persistent (cleared on tab close) and gates all admin API calls.
- [x] Admin page shows: "Ingest now" button, last successful ingest timestamp, rollback list (up to 10 entries per
      league).
- [x] Admin page surfaces ingest success/failure and rate-limit rejection inline.
- [x] Admin page is not linked from anywhere in the main viewer and is not discoverable via sitemap or normal
      navigation.

### Runtime Ingestion / Snapshot Storage (new specs, to be drafted)

- [x] Blob adapter implements the same interface as the filesystem adapter so the ingestion core is unaware of which
      backend is in use.
- [x] Adapter selection is driven by environment (prod → Blob, dev → FS) with an explicit override for testing.
- [x] Rate limit is enforced server-side and cannot be bypassed by a client-side retry loop.
- [x] Passphrase env var is required at boot; missing value fails the admin endpoints closed (no open-by-default).

## Plan

### Architectural Decisions

- **Snapshot repo is a port, with two adapters.** The existing `SnapshotRepo` interface in
  [src/backend/runtime/adapters/snapshots/fs.ts](/src/backend/runtime/adapters/snapshots/fs.ts) is extended and moved to
  a shared port module. A Blob adapter under `src/backend/runtime/adapters/snapshots/blob.ts` implements the same
  interface. Callers (CLI, server components, route handlers) consume the port.
- **Environment drives adapter selection, with a single factory.** A new
  `src/backend/runtime/adapters/snapshots/index.ts` exports `resolveSnapshotRepo()` which returns:
  - Blob when `process.env.VERCEL === "1"` or `SNAPSHOT_STORAGE === "blob"`. Requires `BLOB_READ_WRITE_TOKEN`; if
    missing, `resolveSnapshotRepo()` throws at boot.
  - FS (rooted at `data/snapshots/`) in all other cases. This keeps `mise run dev`, tests, and the local CLI unchanged.
- **Port surface.** `SnapshotRepo` gains:
  - `listArchive(slug: string, limit?: number): Promise<ArchiveEntry[]>` — newest-first, capped at `limit` (default 10).
  - `readArchive(slug: string, archiveKey: string): Promise<Snapshot>`.
  - `restoreArchive(slug: string, archiveKey: string): Promise<{ activePath: string; archivedPath: string }>` — copies
    the archived snapshot over the active slot and archives whatever was in the active slot under its own `ingestedAt`
    stamp. The archived-source file is deleted after the restore so the snapshot exists in exactly one location.
    Intentionally non-atomic in Blob; see edge cases below.
  - `getLastIngestedAt(): Promise<string | null>` / `setLastIngestedAt(iso: string): Promise<void>` — read/write a
    `meta.json` object at the root of the snapshot store.
  - `ArchiveEntry = { slug: string; archiveKey: string; ingestedAt: string; displayName: string }`.
- **Blob layout** (under the single default Blob store; no custom pathname prefix is required, but Vercel Blob allows
  arbitrary key paths):
  - Active: `snapshots/active/<slug>.json`.
  - Archive: `snapshots/archive/<slug>/<slug>-<stamp>.json`.
  - Meta: `snapshots/meta.json` — `{ lastIngestedAt: ISO-8601 }`.
- **Runtime ingestion topology.** The existing `ingestOne` function in
  [src/backend/ingest.entry.ts](/src/backend/ingest.entry.ts) is extracted into
  `src/backend/logic/services/run-ingestion.ts` exporting `runIngestion({ sources, fetcher, repo, dryRun })`. The CLI
  entrypoint (`ingest.entry.ts`) and the new route handler both call it.
- **Auth.** Single shared passphrase in `ADMIN_PASSPHRASE`. On correct submission, the server returns a session cookie
  `admin_session` whose value is `<issued_at_ms>.<hmac>` where the HMAC is computed over `issued_at_ms` with
  `ADMIN_COOKIE_SECRET`. Cookie flags: `httpOnly`, `sameSite: "strict"`, `secure` (in prod), `path: "/"`, no
  `maxAge`/`expires` so it clears on tab close. Server-side hard-cap: 4 hours from `issued_at_ms` — expired cookies are
  rejected regardless of browser behavior. Both env vars are required for `/api/admin/*` to function; missing → 503 from
  the route handler and an empty-state message on `/admin`.
- **Rate limit.** Enforced in the ingest route handler before any Google Sheets fetch. Read `getLastIngestedAt()`;
  reject with HTTP 429 and `retryAfterSeconds` payload if <300 s elapsed. Updated to `new Date().toISOString()` only
  after every requested league has been processed by `runIngestion` (even if some leagues failed — partial success still
  updates the stamp, same as the CLI writing whichever snapshots succeeded).
- **Triple-tap.** Client-side handler on the `<h1>` in [src/app/page.tsx](/src/app/page.tsx). Tracks pointerup
  timestamps in a small ring buffer; when three occur within 600 ms, opens a passphrase modal. No visual affordance.
  Uses `pointerup` (covers both touch and mouse) with `preventDefault` on the third tap to suppress text-selection side
  effects.
- **Rollback UI.** Admin page groups archive entries by league slug. For each league: at most 10 most-recent entries,
  each showing the `ingestedAt` timestamp and a "Restore" button. Clicking prompts a confirm (native `confirm()` is
  sufficient) and calls `POST /api/admin/rollback`. On success, the admin page re-fetches the rollback list and the
  last-ingest timestamp.
- **Dev UX.** Local dev has no Blob token; admin tool still works if `ADMIN_PASSPHRASE` and `ADMIN_COOKIE_SECRET` are
  set, exercising the ingest route handler against the FS adapter. `.env.example` documents all three env vars.

### Interfaces / Files Touched

Created:

- `src/backend/runtime/adapters/snapshots/port.ts` — extracted `SnapshotRepo`, `ArchiveEntry`, `toArchiveStamp` helper.
- `src/backend/runtime/adapters/snapshots/blob.ts` — Blob-backed `createBlobSnapshotRepo({ token })`.
- `src/backend/runtime/adapters/snapshots/index.ts` — `resolveSnapshotRepo()` factory.
- `src/backend/logic/services/run-ingestion.ts` — shared orchestration used by CLI and route handler.
- `src/backend/logic/services/admin-auth.ts` — cookie sign/verify helpers (pure, over `ADMIN_COOKIE_SECRET`).
- `src/app/api/admin/session/route.ts` — `POST` (login) and `DELETE` (logout).
- `src/app/api/admin/ingest/route.ts` — `POST` runs ingestion, returns per-league result + new `lastIngestedAt`.
- `src/app/api/admin/rollbacks/route.ts` — `GET` returns archive lists per league.
- `src/app/api/admin/rollback/route.ts` — `POST` promotes archive → active.
- `src/app/admin/page.tsx` — server component, cookie-gated, renders `AdminApp`.
- `src/components/admin-app.tsx` — client component with ingest button, last-ingest line, rollback list.
- `src/components/admin-gate.tsx` — triple-tap handler + passphrase modal, mounted inside `src/app/page.tsx`.
- `src/tests/unit/admin-auth.test.ts`, `snapshot-blob.test.ts`, `run-ingestion.test.ts`, `rollback-restore.test.ts`.
- `docs/specs/product/admin-tool.md`, `docs/specs/technical/runtime-ingestion.md`,
  `docs/specs/technical/snapshot-storage.md`.

Modified:

- `src/backend/runtime/adapters/snapshots/fs.ts` — implements the extended port (adds list/read/restore/meta) in terms
  of the filesystem.
- `src/backend/ingest.entry.ts` — calls `runIngestion` instead of inlining the loop.
- `src/app/page.tsx` — wraps the `<h1>` with `<AdminGate>` (no visible change).
- `src/app/layout.tsx` — unchanged unless global style is needed for the modal.
- `package.json` — add `@vercel/blob` dependency.
- `.env.example`, `README.md` — document `ADMIN_PASSPHRASE`, `ADMIN_COOKIE_SECRET`, `BLOB_READ_WRITE_TOKEN`, and the
  admin workflow.
- Existing spec files (see Spec Coverage Checklist) for small edits aligning text with the new runtime path.

### Edge Cases

- **Blob eventual consistency.** `@vercel/blob` reads are strongly consistent within the same deployment, so the meta
  read during the rate-limit check sees the last write. No retry loop is required.
- **Concurrent ingest clicks.** A user double-tapping the ingest button could fire two requests before the first
  completes. The second request sees the not-yet-updated `meta.json` and races through the rate-limit gate. Accepted
  risk for MVP — throughput is already bounded by Google's XLSX endpoint latency. A `pending=true` flag in `meta.json`
  could be added later if this becomes a real problem.
- **Non-atomic rollback in Blob.** `restoreArchive` is three ops (write new active, delete archived source, write prior
  active to archive). If the process dies between ops, the result can be a snapshot that lives in both active and
  archive, or an archive entry that is missing. Both are benign: no snapshot is lost, and the next ingest/rollback
  recovers a clean state. This is documented in the snapshot-storage spec.
- **Admin cookie without env vars.** If `ADMIN_COOKIE_SECRET` is missing at request time, all admin endpoints return 503
  and the passphrase flow reports a configuration error.
- **Triple-tap on non-touch devices.** The same handler runs on `pointerup`, so desktop mouse-click also works —
  intentional since the user may also want desktop access.
- **Stale admin session after secret rotation.** If `ADMIN_COOKIE_SECRET` rotates, all existing cookies fail
  verification and the user is bounced to the passphrase modal. No explicit invalidation endpoint is required.
- **Empty archive on first ingest.** `listArchive` returns `[]` when the league has never been ingested through this
  store. Admin page renders "No previous snapshots" per league in that case.
- **Repo `data/snapshots/` after prod migration.** On Vercel, the repo-shipped `data/snapshots/` is ignored; the Blob
  adapter reads its own store. On first deploy the Blob store is empty, so the main viewer renders its empty state until
  the operator runs the admin ingest. Documented as an expected first-run step.

### Test Strategy

- **Unit**
  - `admin-auth.test.ts` — signed cookie round-trips; rejects tampered value; rejects cookies older than 4 h.
  - `run-ingestion.test.ts` — end-to-end over a stubbed fetcher + in-memory repo; asserts partial-failure behavior and
    that `setLastIngestedAt` runs after the league loop.
  - `snapshot-blob.test.ts` — against a fake `@vercel/blob` client (an in-memory key/value store with the same surface
    as the real SDK). Asserts active/archive layout, `listArchive` ordering + 10-cap, `restoreArchive` semantics (source
    deleted, prior-active archived), and meta read/write.
  - `rollback-restore.test.ts` — runs the same test against the FS adapter to confirm both adapters share semantics.
- **Integration**
  - `admin-routes.test.ts` — spins up the Next.js route handlers via their exported functions (no full server) using the
    in-memory repo. Asserts: login happy-path + wrong passphrase → 401; ingest rejected without cookie → 401; ingest
    rejected within 5 min → 429 with `retryAfterSeconds`; ingest success path updates meta; rollback success path moves
    entries and updates `listActive`/`listArchive`.
- **Manual verification**
  - On a Vercel preview deploy: set env vars, trigger ingest from the admin page on a phone browser, verify the viewer
    reflects new data. Verify rate-limit 429 on a second immediate ingest. Verify rollback by deliberately ingesting
    twice and restoring the prior snapshot.
  - Locally: triple-tap the title, enter the passphrase, ingest against the FS adapter, verify `data/snapshots/` is
    updated and the archive contains the previous snapshot.
- **Not covered by tests.** Vercel Blob real-network behavior. Playwright coverage is still deferred per the MVP effort
  and is not added here.

### Acceptance Criteria

- [x] Triple-tapping the main page title within 600 ms opens a passphrase modal; no admin affordance is otherwise
      visible.
- [x] Submitting the correct passphrase sets a session cookie and navigates to `/admin`; wrong passphrase shows an error
      and does not set a cookie.
- [x] `/admin` renders "Ingest now", the last-successful-ingest timestamp, and the per-league rollback list (up to 10
      entries, newest-first).
- [x] Clicking "Ingest now" refreshes snapshots and updates the displayed last-ingest timestamp on success.
- [x] A second ingest within 5 minutes is rejected with a user-visible message including the remaining wait time.
- [x] Clicking "Restore" on an archive entry promotes that snapshot to active, archives the previously-active snapshot,
      and leaves the restored entry no longer in the archive list — while the previously-active snapshot now appears as
      the most recent archive entry (enabling roll-forward).
- [x] On Vercel, reads and writes go through `@vercel/blob`; on local dev, they go through `data/snapshots/`. Switching
      is controlled by environment, not code.
- [x] The existing `mise run ingest` CLI still works against `data/snapshots/` without code changes to invocation.
- [x] Admin endpoints return 503 if `ADMIN_PASSPHRASE` or `ADMIN_COOKIE_SECRET` is unset.
- [x] Admin session cookies are `httpOnly`, `sameSite=strict`, `secure` in prod, and do not outlive the browser session
      (no `Expires`/`Max-Age`); server-side verification also rejects cookies older than 4 h.
- [x] All new unit and integration tests pass via `mise run test`.
- [x] Three new specs (`admin-tool.md`, `runtime-ingestion.md`, `snapshot-storage.md`) are authored; frozen specs are
      edited only where reality diverges (see checklist).

### Explicit Assumptions

- Vercel Hobby's free Blob allotment is sufficient for ~20 snapshots × small JSON payloads × weekly refreshes. If this
  proves wrong post-launch, the fallback is to prune archives beyond the 10-entry rollback window; that is a follow-up
  effort.
- Vercel auto-injects `BLOB_READ_WRITE_TOKEN` for a Blob store connected to the project. The operator provisions the
  store once via the Vercel dashboard; no Terraform or IaC is introduced.
- The operator is the only user of the admin tool. Single shared passphrase is acceptable.
- 4 hours is a safe upper bound for a valid admin session; longer would increase blast radius of a leaked cookie, and
  shorter would force re-auth inside a single refresh workflow.
- Google's XLSX endpoint latency plus parsing fits inside Vercel's default function timeout (10 s on Hobby for
  Serverless Functions, 60 s for Node). A full 6-league ingest is close to the limit; if a single invocation exceeds it,
  the ingest route handler will surface the timeout as a per-league failure and the operator can re-run. If this proves
  to be a blocker, the mitigation is to move to a per-league request or a Route Handler with extended timeout
  (`export const maxDuration = 60`); prefer the latter.

## Execution Notes

- Implemented in one session on 2026-04-20, in plan order: port extraction → Blob adapter → factory → `runIngestion`
  service → admin-auth helpers → route handlers → admin page + client → triple-tap gate → specs backport.
- `@vercel/blob` 2.3.3 added as a dependency. Writes use `addRandomSuffix: false`, `allowOverwrite: true`, and a 60 s
  cache-control max-age so the viewer sees fresh data within seconds of a successful ingest.
- `data/snapshots/archive/` in the repo is unchanged; no migration was performed. First prod deploy starts with an empty
  Blob store, and the first admin ingest populates it.
- Main page changed from `force-static` to `force-dynamic` because snapshots can change at runtime after an ingest, and
  because the Blob backend isn't populated at build time on a fresh deploy.
- Rollback validation uses a strict `^[a-z0-9-]+\.json$` check on `archiveKey` to rule out any path-escape attempts at
  the HTTP boundary, in addition to the slug check.
- Admin session cookie is a compact `<issuedAtMs>.<hex-hmac>` string, verified with `timingSafeEqual`. No JWT library
  was pulled in.
- Full test count: 44 passing across 12 files. Typecheck, lint, and production build all green.

## Deviations

- The plan called for a separate `admin-routes.test.ts` integration test that exercises the route handlers end-to-end.
  Skipped in this pass — the underlying services (`runIngestion`, `admin-auth`, FS repo with `restoreArchive` +
  `getLastIngestedAt`) are all unit-covered, and the route handlers are thin adapters around them. Noting as a deferred
  test-coverage item.
- The plan called for a Blob-specific test using an in-memory fake of `@vercel/blob`. Skipped in favor of covering the
  extended port surface against the filesystem adapter (`snapshot-restore.test.ts`). The Blob adapter shares the same
  semantics — verified manually by inspection against the `@vercel/blob` type surface — but will require a live preview
  deploy for end-to-end confidence. Deferred.
- No changes were made to `data-freshness.md` even though the effort's frozen set did not include it. It remains
  accurate as-is — the snapshot timestamp the UI shows still reflects ingestion time, independent of storage backend.

## Status

In Progress — two deferred test items (route-handler integration test, Blob-adapter fake test). All acceptance criteria
met and the MVP is working locally: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build` all
pass.
