# Effort

- Name: Vercel Cron — Nightly Ingest
- Date: 2026-05-02
- Time: 13:20
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-05-02 13:30

## Scope

Add an automated daily ingestion of every in-scope league sheet, scheduled via Vercel Cron. The cron is the system's new
primary refresh mechanism; the existing operator-triggered admin ingest stays as a manual "force refresh now" escape
hatch.

In scope:

- A new Next.js route handler `GET /api/cron/ingest` that authenticates Vercel Cron's request via
  `Authorization: Bearer ${CRON_SECRET}` and runs `runIngestion` against the same `LEAGUE_SOURCES` and snapshot repo the
  admin route uses.
- A new top-level [/vercel.json](/vercel.json) declaring a single cron entry pointing at the new route.
- A new `CRON_SECRET` environment variable, documented in `.env.example` and required at runtime by the new route.
- Documentation updates to the four specs whose Non-Goals or Requirements currently exclude or omit scheduled ingestion:
  `data-freshness.md`, `runtime-ingestion.md`, `spreadsheet-ingestion.md`, `deployment.md`.
- A unit test that exercises the route's auth gate and the rate-limit "skip but report success" semantics with a fake
  repo + fake fetcher (mirroring the existing `run-ingestion.test.ts` shape).

Out of scope (non-goals):

- Multi-trigger cron (one daily fire is sufficient on Vercel Hobby and matches the user's stated cadence — "every day
  overnight").
- Per-day-of-week scheduling (e.g. only run after Sunday/Monday/… nights). Daily covers the same ground without Pro.
- Push notifications, email summaries, or alerting on cron failures beyond what Vercel surfaces natively.
- Changing the existing admin ingest UX, the admin auth model, or the snapshot-storage adapter.
- Any change to the parsing/outcome logic.

## Spec Set (Frozen)

- [/docs/specs/product/data-freshness.md](/docs/specs/product/data-freshness.md) (v2)
- [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md) (v1)
- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) (v6)
- [/docs/specs/technical/deployment.md](/docs/specs/technical/deployment.md)
- [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md) (read-only — no change
  expected)

## Spec Coverage Checklist

- [x] `data-freshness.md` Non-Goals updated: remove "Automatic background refresh. Ingestion is explicitly
      operator-triggered" and replace with language acknowledging that automatic daily refresh now exists alongside the
      operator-triggered path.
- [x] `runtime-ingestion.md` Non-Goals updated: remove "Automatic scheduled ingestion (e.g. Vercel cron)."
- [x] `runtime-ingestion.md` Requirements section gains a clause covering `GET /api/cron/ingest`: bearer-token auth,
      same `runIngestion` core, rate-limit-tolerant 200, anomaly surfacing.
- [x] `spreadsheet-ingestion.md` Requirements (the bullet listing CLI + `POST /api/admin/ingest`) is extended with the
      cron-triggered HTTP path so the three invocation modes are enumerated.
- [x] `deployment.md` documents `CRON_SECRET` alongside the other env vars and notes the daily cron.
- [x] Acceptance criteria below all check off.

## Plan

### Approach

Vercel Cron sends a `GET` request to a configured path on a UTC-cron schedule, with
`Authorization: Bearer ${CRON_SECRET}` attached automatically. The handler must (a) verify the bearer token, (b) run the
same ingestion the admin tool runs, (c) succeed-fast and idempotent in the face of the existing 5-minute cooldown.

Why a separate route rather than reusing `POST /api/admin/ingest`:

- Vercel Cron only sends `GET`, never `POST`.
- Vercel Cron does not pass cookies; the admin route's session-cookie auth would fail. Reusing the route would force
  either weakening admin auth (bad) or branching auth modes inside one handler (worse).
- A dedicated `cron/ingest` route keeps the auth contract obvious: bearer-token = cron, cookie = operator. They share
  exactly one thing — the underlying `runIngestion` call — which is already factored as a service.

Cooldown handling: the admin route returns 429 when called inside the 5-minute cooldown. The cron route should not
return 429 — Vercel surfaces non-2xx responses as cron failures, and a benign cooldown collision (e.g. an operator just
ran a manual ingest) should not alert the operator. The cron route returns 200 with
`{ skipped: true, reason: "cooldown" }` in those cases. Hard failures (config missing, parse-pipeline crash) still
return non-2xx so Vercel surfaces them.

### Files touched

- New: [/src/app/api/cron/ingest/route.ts](/src/app/api/cron/ingest/route.ts).
  - Exports `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`.
  - `export async function GET(req: Request)`.
  - Reads `CRON_SECRET`. If missing, returns 503 with `{ error: "CRON_SECRET not configured" }` (treated as a hard
    failure so misconfiguration is visible).
  - Reads `Authorization` header; rejects 401 if not `Bearer ${CRON_SECRET}`.
  - Calls `repo.getLastIngestedAt()`; if elapsed < `INGEST_COOLDOWN_MS` (5 min, same constant as admin route), returns
    200 with `{ ok: true, skipped: true, reason: "cooldown", lastIngestedAt }`.
  - Otherwise calls `runIngestion({ sources: LEAGUE_SOURCES, fetcher: createSheetsFetcher(), repo })`.
  - Builds the response shape from the result. Returns 200 even if individual leagues failed (mirrors admin route's
    `anyFailed` handling — the cron should not be marked failed because one league's sheet was unreachable; the response
    body and Vercel logs already make per-league failures visible).
  - On unexpected exception (pipeline crash), logs and returns 500.
- New: [/vercel.json](/vercel.json):

  ```json
  {
    "crons": [{ "path": "/api/cron/ingest", "schedule": "0 8 * * *" }]
  }
  ```

  `0 8 * * *` UTC = 4:00 AM Eastern (US/Detroit). Comfortably overnight, after Sunday-Monday cutoff, before any weekday
  morning traffic.

- Edit: [/.env.example](/.env.example) — add `CRON_SECRET=` (no default value; treat as required-in-prod).
- Edit: [/docs/specs/product/data-freshness.md](/docs/specs/product/data-freshness.md): rewrite the "Automatic
  background refresh" Non-Goal so it acknowledges the new cron path; bump version to v3 and update Last Updated.
- Edit: [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md): drop the "Automatic
  scheduled ingestion" Non-Goal; add a Must clause for `GET /api/cron/ingest`; bump version to v2.
- Edit: [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md): expand the
  "invokable in two ways" bullet to "three ways" listing CLI, admin HTTP, cron HTTP; bump version to v7.
- Edit: [/docs/specs/technical/deployment.md](/docs/specs/technical/deployment.md): add `CRON_SECRET` to the env-var
  list; note the daily cron schedule.
- New tests: [/src/tests/unit/cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts) — pure-Node tests of the route
  handler logic via direct `GET` invocation with a fake repo + fake fetcher (same harness style as the existing
  `run-ingestion.test.ts`). Vitest, no Next.js test server.

### Schedule details

| Setting     | Value             | Notes                                                                            |
| ----------- | ----------------- | -------------------------------------------------------------------------------- |
| Cron expr   | `0 8 * * *`       | UTC. Daily at 08:00 UTC = 04:00 ET (DST-aware on the client; 03:00 in EDT).      |
| Plan tier   | Hobby             | Vercel Hobby permits at most one cron invocation per day, which fits.            |
| Timeout     | `maxDuration: 60` | Same as admin route. A full 6-league run completes well under 60 s.              |
| Idempotency | Cooldown stamp    | 5-minute cooldown via `meta.json` prevents back-to-back runs from doubling work. |

### Auth contract

`Vercel Cron` automatically attaches `Authorization: Bearer ${CRON_SECRET}` to the outbound request when `CRON_SECRET`
is set in the project's environment variables.

| Header value                 | Outcome                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `Bearer <CRON_SECRET>` (eq)  | Authorized; proceed to ingestion.                                         |
| Anything else, or absent     | 401 `{ error: "Unauthorized" }`.                                          |
| `CRON_SECRET` missing in env | 503 `{ error: "CRON_SECRET not configured" }` regardless of header value. |

Constant-time comparison (`timingSafeEqual` on equal-length buffers) is used so a vendor wishing to time-probe the
secret cannot. If lengths differ, fail fast.

### Failure-mode contract

| Condition                          | Response                                         | Vercel cron status |
| ---------------------------------- | ------------------------------------------------ | ------------------ |
| Auth missing/invalid               | 401                                              | Failed             |
| `CRON_SECRET` env missing          | 503                                              | Failed             |
| In cooldown window                 | 200 `{ ok: true, skipped: true, reason }`        | Succeeded          |
| Ingestion ran; some leagues failed | 200 with per-league result array (mirrors admin) | Succeeded          |
| Ingestion ran; all succeeded       | 200 with per-league result array                 | Succeeded          |
| Pipeline crash (exception)         | 500 with error message                           | Failed             |

The "succeed on per-league failure" choice matches the admin route's existing behavior and prevents a single sheet
outage from triggering a daily cron alert. Per-league anomalies still appear in the response body and the Vercel
function logs, where they're auditable.

### Edge cases

- **Operator runs a manual ingest at 03:58 ET; cron fires at 04:00 ET.** Manual run sets `lastIngestedAt`. Cron sees
  elapsed < 5 min, returns `{ skipped: true }`, exits 200. Snapshot is already current; no double work, no alarm.
- **Sheets is down at 04:00.** Per-league failures bubble into the result array. Response is 200. Tomorrow's cron
  retries automatically.
- **Vercel Blob is down.** The repo throws on read or write. `runIngestion` propagates; route returns 500. Vercel cron
  alert fires.
- **`CRON_SECRET` rotated mid-day.** Old token in flight (Vercel cron is invoked with the current env value) so this
  isn't a real race. New runs use new value.
- **DST transition.** `0 8 * * *` UTC fires at 04:00 ET in EDT (summer) and 03:00 ET in EST (winter). User's stated goal
  is "overnight"; both windows satisfy that. No DST handling needed.
- **Hobby cron schedule precision.** Vercel Hobby crons may fire ±1 hour from the configured time. That's still well
  within "overnight" and not worth designing around.
- **Concurrent cron + admin within the cooldown.** Whichever lands first wins; the second is skipped (admin) or
  cooldown-skipped (cron). Both behaviors are intentional.
- **Cron-route called from the public internet.** Token check rejects unauthorized requests with 401. Even if a token
  were leaked, the cooldown caps the attack surface to one ingest per 5 minutes; the worst-case is "your data refreshes
  more often." No data exfil risk: the route does not echo back snapshot contents, only result metadata.

### Test strategy

Pure unit tests in `src/tests/unit/cron-ingest.test.ts` (Vitest):

- Auth gate: missing header → 401; wrong scheme → 401; correct bearer → proceeds.
- Missing `CRON_SECRET` env → 503 even when header looks correct.
- In-cooldown: fake repo with a recent `lastIngestedAt` → 200 with `skipped: true, reason: "cooldown"`.
- Successful run: fake repo + fake fetcher → 200 with per-league result array; `setLastIngestedAt` called.
- Per-league failure: fake fetcher that throws for one slug → 200, result shows that slug's failure.
- Pipeline crash: fake repo that throws on `getLastIngestedAt` → 500.

Tests construct a `Request` with the right `Authorization` header and invoke the exported `GET` directly. No Next.js
runtime required.

Manual smoke (deferred to post-deploy): set `CRON_SECRET` in Vercel; trigger the route from the project dashboard via
"Run cron now"; verify 200 response and a Blob update.

### Acceptance criteria

- [x] `GET /api/cron/ingest` exists and is implemented per the auth and failure-mode contracts above.
- [x] `vercel.json` declares the cron at `0 8 * * *` UTC.
- [x] `.env.example` lists `CRON_SECRET=`.
- [x] All four spec files listed in Spec Coverage Checklist are updated and version-bumped where applicable.
- [x] `mise run lint`, `mise run typecheck`, `mise run fmt-check`, and `mise run test` all pass.
- [x] Six new unit tests covering the auth gate, env-missing path, cooldown skip, success path, per-league failure path,
      and pipeline-crash path are added and pass.

### Assumptions / defaults chosen

- `0 8 * * *` UTC (= 04:00 ET) is "overnight enough." If the user prefers a different slot (e.g. `0 7 * * *` UTC = 03:00
  ET), a one-line edit to `vercel.json` is enough. We default to 04:00 ET because Sunday-night matches typically end by
  midnight and 04:00 leaves margin for late-edited sheets.
- Daily cadence is right. Per-day-of-week (e.g. only after league nights) would require six cron entries and only Vercel
  Pro supports >1/day, so daily is both simpler and within Hobby limits.
- "Soft fail on per-league failure, hard fail on infra crash" matches the user's stated preference in chat ( "non-200 on
  hard failure, 200 with details on soft failures").
- The `INGEST_COOLDOWN_MS` constant should be lifted to a shared module if it ends up duplicated; for the initial
  implementation, importing the existing constant from the admin route or extracting a `runtime-ingestion-config.ts`
  with a single `INGEST_COOLDOWN_MS` export is preferred. Plan defaults to extraction so the constant is owned in one
  place.

## Execution Notes

- Extracted `INGEST_COOLDOWN_MS` into
  [/src/backend/logic/services/runtime-ingestion-config.ts](/src/backend/logic/services/runtime-ingestion-config.ts) and
  switched the existing admin route to import from it. Both routes now share the cooldown constant.
- Factored the cron handler logic out of the route file into
  [/src/backend/logic/services/cron-ingest.ts](/src/backend/logic/services/cron-ingest.ts) as a pure
  `handleCronIngest({ authorization, cronSecret, sources, fetcher, repo, now })` function so the unit tests don't need a
  Next.js request mock. The route module is a thin shim that wires `process.env.CRON_SECRET`, `resolveSnapshotRepo()`,
  and `createSheetsFetcher()` into the handler and wraps the result in a `NextResponse`.
- Bearer comparison uses `node:crypto.timingSafeEqual` after a length-equality short-circuit (mismatched lengths fail
  fast since `timingSafeEqual` requires equal-length buffers).
- Added [/vercel.json](/vercel.json) with one cron entry; nothing else was needed there.
- Added `CRON_SECRET=` to `.env.example` with a generation hint.
- Six unit tests in [/src/tests/unit/cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts) cover: missing
  `CRON_SECRET` → 503, missing/wrong bearer → 401, in-cooldown → 200 skipped, success path, per-league failure path, and
  pipeline crash → 500. All pass alongside the existing 122 tests (now 128).
- Spec edits: `data-freshness.md` v2 → v3 (Non-Goal removed, Context paragraph rewritten); `runtime-ingestion.md` v1 →
  v2 (Non-Goal removed, new Must clauses for `GET /api/cron/ingest`); `spreadsheet-ingestion.md` v6 → v7 (invocations
  bullet now lists three modes); `deployment.md` v2 → v3 (Goal added, env-vars/cron paragraph added, obsolete May bullet
  replaced).

## Deviations

- The plan implied the cron route would inline its handler logic. Instead the handler is factored into
  `src/backend/logic/services/cron-ingest.ts`, with the route file a thin shim. This is a strictly additive change that
  keeps the unit tests pure-Node and mirrors the project's existing service/adapter split.

## Status

Done
