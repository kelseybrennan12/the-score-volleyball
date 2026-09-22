# Effort

- Name: One Ingestion module
- Date: 2026-09-22
- Time: 14:50
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-22 14:54 UTC

## Scope

Second candidate of the 2026-09-22 architecture review: no module owns "may an Ingestion run start, run it, report it".
The cooldown check is implemented twice with different HTTP meanings
([src/backend/logic/services/cron-ingest.ts](/src/backend/logic/services/cron-ingest.ts) answers 200 skipped,
[src/app/api/admin/ingest/route.ts](/src/app/api/admin/ingest/route.ts) answers 429), a one-line
[runtime-ingestion-config.ts](/src/backend/logic/services/runtime-ingestion-config.ts) exists only to keep the two
copies in lockstep, every entrypoint assembles the same source list, fetcher, and store, and `LeagueResult` carries
object-store keys (`activePath`, `archivedPath`) that the admin route strips by hand and the admin UI re-declares.

In scope:

- One Ingestion module, [src/backend/logic/services/ingestion.ts](/src/backend/logic/services/ingestion.ts) (renamed
  from [run-ingestion.ts](/src/backend/logic/services/run-ingestion.ts)):
  `runIngestion({ trigger, sources, fetcher, store, dryRun?, now? })` returns a domain outcome, `ran` or `skipped`, with
  per-league outcomes as a discriminated union and no storage keys. The cooldown is enforced inside, for the `cron` and
  `admin` triggers only.
- The outcome and trigger types and `INGEST_COOLDOWN_MS` move to
  [src/shared/domain/ingestion.ts](/src/shared/domain/ingestion.ts) as the cross-runtime contract; the admin UI imports
  them instead of its hand copy.
- Pure HTTP helpers in [src/backend/logic/services/ingestion-http.ts](/src/backend/logic/services/ingestion-http.ts):
  `authorizeCronRequest`, `toAdminIngestResponse` (skipped → 429 with `retryAfterSeconds` and `Retry-After`),
  `toCronIngestResponse` (always 200).
- One composition root, `createIngestionDeps()` in
  [src/backend/runtime/bootstrap/ingestion.ts](/src/backend/runtime/bootstrap/ingestion.ts), used by the CLI and both
  routes.
- Delete [cron-ingest.ts](/src/backend/logic/services/cron-ingest.ts),
  [runtime-ingestion-config.ts](/src/backend/logic/services/runtime-ingestion-config.ts), and
  [cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts) (its cases are ported to the two new seams). The CLI
  summary drops the two path fragments.
- Spec deltas (done before this effort): runtime-ingestion v3, spreadsheet-ingestion v10.

Out of scope: the remaining review candidates (Viewer selection transitions, Announcement/Dismissal, the Admin endpoint
wrapper for guard/body/error handling, the rest of the Admin client contract, Season archive edge); the admin UI's
`parseJsonResponse` copy; a single-league HTTP variant.

## Spec Set (Frozen)

- [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md) (v3)
- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) (v10)
- [/docs/specs/product/admin-tool.md](/docs/specs/product/admin-tool.md) (v3, unchanged: 5-minute rate limit with a
  user-visible remaining wait; per-league result block with counts, roster diff, anomalies)
- [/CONTEXT.md](/CONTEXT.md)

## Spec Coverage Checklist

- [x] `runIngestion` with trigger `cron` or `admin` returns `skipped` with `reason: "cooldown"`, `lastIngestedAt`, and
      `retryAfterMs` when the last ingest is under 5 minutes old, without fetching anything.
- [x] Trigger `cli` ignores the cooldown; a dry run under any trigger neither writes nor stamps.
- [x] A `ran` outcome stamps `lastIngestedAt` even when some leagues failed, and its per-league outcomes carry counts,
      roster diff, and anomalies or a one-line error, and never a storage key.
- [x] The admin route answers 429 with `error`, `retryAfterSeconds`, `lastIngestedAt`, and a `Retry-After` header on
      `skipped`, and 200 with the outcome on `ran`; the cron route answers 200 with the outcome in both cases; an
      unexpected exception still answers 500 in both.
- [x] `authorizeCronRequest` rejects a missing secret with 503 and a missing, mis-schemed, or wrong bearer with 401,
      using a constant-time comparison.
- [x] The CLI, the admin route, and the cron route obtain their dependencies from `createIngestionDeps()`; the CLI's
      `--league` and `--dry-run` flags and non-zero exit on any failed league are unchanged; its summary prints counts
      and roster diff and no paths.
- [x] The admin UI imports the outcome types from [src/shared/domain/ingestion.ts](/src/shared/domain/ingestion.ts),
      reads `leagues`, and still shows the rate-limit wait, per-league status, counts, roster diff, and anomalies.
- [x] [cron-ingest.ts](/src/backend/logic/services/cron-ingest.ts),
      [runtime-ingestion-config.ts](/src/backend/logic/services/runtime-ingestion-config.ts), and
      [cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts) are gone; no production code imports them; AGENTS.md
      repo surface names the new module, contract, helpers, and bootstrap.
- [x] Typecheck, lint, format check, and the full unit suite pass.

## Plan

Interfaces:

```ts
// src/shared/domain/ingestion.ts
export const INGEST_COOLDOWN_MS = 5 * 60 * 1000;
export type IngestionTrigger = "cli" | "cron" | "admin";
export type RosterDiff = "same" | "changed"; // moved here from roster-diff.ts, which re-exports it
export type LeagueOutcome =
  | { slug: string; ok: true; teamCount: number; matchCount: number; rosterDiff: RosterDiff; anomalies: string[] }
  | { slug: string; ok: false; error: string };
export type IngestionOutcome =
  | { status: "ran"; ranAt: string; dryRun: boolean; leagues: LeagueOutcome[] }
  | { status: "skipped"; reason: "cooldown"; lastIngestedAt: string; retryAfterMs: number };

// src/backend/logic/services/ingestion.ts
export interface RunIngestionInput {
  trigger: IngestionTrigger;
  sources: LeagueSource[];
  fetcher: SheetsFetcher;
  store: SnapshotStore;
  dryRun?: boolean;
  now?: () => Date;
}
export function runIngestion(input: RunIngestionInput): Promise<IngestionOutcome>;

// src/backend/logic/services/ingestion-http.ts
export function authorizeCronRequest(
  authorization: string | null,
  cronSecret: string | undefined,
): { ok: true } | { ok: false; status: 401 | 503; error: string };
export function toAdminIngestResponse(outcome: IngestionOutcome):
  | { status: 200; body: IngestionOutcome }
  | {
      status: 429;
      body: { error: string; retryAfterSeconds: number; lastIngestedAt: string };
      headers: { "Retry-After": string };
    };
export function toCronIngestResponse(outcome: IngestionOutcome): { status: 200; body: IngestionOutcome };

// src/backend/runtime/bootstrap/ingestion.ts
export function createIngestionDeps(): { sources: LeagueSource[]; fetcher: SheetsFetcher; store: SnapshotStore };
```

Steps:

1. TDD at the `runIngestion` seam in [src/tests/unit/ingestion.test.ts](/src/tests/unit/ingestion.test.ts) (renamed from
   [run-ingestion.test.ts](/src/tests/unit/run-ingestion.test.ts), its three cases kept and re-shaped to the outcome):
   cron and admin skip inside the cooldown with `retryAfterMs` and no fetch; cli runs inside the cooldown; dry run
   neither writes nor stamps; `ran` stamps despite a failed league; per-league outcomes carry no
   `activePath`/`archivedPath`; a store failure propagates as a thrown error (the routes' 500 path).
2. TDD at the `ingestion-http` seam in [src/tests/unit/ingestion-http.test.ts](/src/tests/unit/ingestion-http.test.ts):
   the three ported auth cases plus the 503; admin `ran` → 200, `skipped` → 429 with
   `retryAfterSeconds = ceil(retryAfterMs / 1000)` and the header; cron `skipped` → 200.
3. Implement the shared contract, the module (absorbing [cron-ingest.ts](/src/backend/logic/services/cron-ingest.ts) and
   the config constant), and the helpers; delete the two absorbed files and
   [cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts).
4. Add `createIngestionDeps()`; move [ingest.entry.ts](/src/backend/ingest.entry.ts), the admin route, and the cron
   route onto it and the helpers; the CLI summary prints counts and roster diff. Typecheck is the gate for the routes
   and the CLI.
5. Move [admin-app.tsx](/src/components/admin-app.tsx) onto the shared types (`leagues`, `status`); typecheck is the
   gate.
6. Update AGENTS.md; check off the coverage checklist.
7. Gates: `mise run typecheck`, `mise run lint`, `mise run fmt-check`, `mise run test`. Then a `spec-alignment` audit
   against the frozen spec set, and a dev-preview check of the Admin page's ingest result block.
8. Commit on this branch and open a PR.

Explicit defaults chosen:

- The cooldown applies by trigger (`cron`, `admin`), not by a caller-supplied flag; the CLI's exemption is the spec's,
  so it lives in the module.
- `retryAfterMs` is reported by the module; the admin helper rounds it up to whole seconds for the header.
- `RosterDiff` moves to the shared contract so `src/shared/` never imports from `src/backend/`.
- The `ran` outcome is the HTTP body as-is for both routes; the cron body shape changes (nothing but Vercel's 2xx check
  reads it) and the admin UI is updated in the same change.

Acceptance criteria: every item in the Spec Coverage Checklist checked, the PR opened.

## Execution Notes

- Plan approved in chat by Kelsey Brennan after the grilling session on this candidate.
- TDD in vertical slices at the two agreed seams:
  - `runIngestion` (9 tests in [src/tests/unit/ingestion.test.ts](/src/tests/unit/ingestion.test.ts), renamed from
    [run-ingestion.test.ts](/src/tests/unit/run-ingestion.test.ts)): a run writes and stamps; a failed league is
    reported and the run still stamps; league outcomes carry no storage keys; a dry run neither writes nor stamps; cron
    and admin skip inside the cooldown with the remaining wait and no fetch; the CLI runs inside the cooldown; exactly 5
    minutes runs; a store failure throws.
  - `ingestion-http` (10 tests in [src/tests/unit/ingestion-http.test.ts](/src/tests/unit/ingestion-http.test.ts)): the
    accepted bearer, 503 without a secret, 401 for a missing header, wrong scheme, and wrong secret, and a
    same-character-length non-ASCII header; admin 200 and 429 with rounded-up seconds and `Retry-After`; cron 200 for
    both outcomes.
- Every behaviour of the deleted [cron-ingest.test.ts](/src/tests/unit/cron-ingest.test.ts) is covered at one of the two
  seams, except the route-level 500 (see Deviations).
- Runtime checks: `mise run ingest -- --dry-run` fetched and parsed all four Fall leagues, printed the new summary
  (counts and roster diff, no paths), and left `data/` untouched. On the dev server, which has no `CRON_SECRET` or admin
  configuration, both routes answered 503 before doing any work, with no server errors logged. The Admin page's ingest
  result block was not exercised: it needs the admin passphrase, and a valid run would rewrite the checked-in snapshots;
  it is on the PR's test plan.
- Review: a Standards pass and a Spec pass ran as parallel sub-agents. Applied: effort-file paths linked; the unused
  `RosterDiff` re-export removed; the Admin page's `result` names renamed for what they hold; `RunIngestionInput`
  extends an `IngestionDeps` type owned by the module (the bootstrap imports it); the CLI rejects an unknown `--league`
  before wiring the environment so it still exits 2 when the store cannot be built; base-url imports in the CLI. Kept,
  as agreed in grilling: `toCronIngestResponse` as a tested helper; the HTTP helpers under `services/` (repo practice,
  though contributing.md places transport wrappers under `runtime/bootstrap/`). Left for the Admin endpoint candidate:
  the two routes' duplicated `catch` blocks. The `spec-alignment` audit found every touched MUST/SHOULD implemented; its
  findings are resolved above or recorded below.
- Gates: `mise run typecheck`, `mise run lint`, `mise run fmt-check`, `mise run test` pass.

## Deviations

- [src/backend/logic/services/ingestion-http.ts](/src/backend/logic/services/ingestion-http.ts)'s `authorizeCronRequest`
  compares byte lengths before the constant-time compare. The old check compared character lengths, so a non-ASCII
  header of the right character length made `timingSafeEqual` throw a `RangeError` and the cron route fail with an
  unhandled error instead of a 401. Found while porting; fixed test-first.
- The route-level 500 on an unexpected exception is no longer under test: the old cron test reached it through
  `handleCronIngest`, and now the module's throw is tested but the routes' `catch` blocks are gated only by typecheck.
  They get a seam with the Admin endpoint candidate.
- `IngestionDeps` lives in the module rather than the bootstrap, so `logic/` never imports from `runtime/bootstrap/`.
- The CLI filters `LEAGUE_SOURCES` itself before calling `createIngestionDeps()` (see Execution Notes); the plan had it
  filter the bootstrap's list.
- Open naming question for Kelsey Brennan: CONTEXT.md already defines **Outcome** as a match's set result, and
  `IngestionOutcome` / `LeagueOutcome` reuse the word. Not renamed pending that decision.

## Status

Done
