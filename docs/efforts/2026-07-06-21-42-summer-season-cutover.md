# Effort

- Name: Summer 2026 Season Cutover + Previous Seasons Archive
- Date: 2026-07-06
- Time: 21:42
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-07-06 21:42

## Scope

Cut the live app over from Spring 2026 to Summer 2026, and introduce a frozen "previous seasons" archive that keeps
Spring 2026 browsable from the Standings tab without keeping it in the live data set.

Three outcomes:

1. **Live season = Summer 2026.** [`LEAGUE_SOURCES`](/src/backend/logic/core/league-sources.ts) points at the six Summer
   2026 spreadsheets. Ingestion (CLI, admin route, cron) writes `active/summer-*.json`. Team / Now / Standings views
   reflect summer.
2. **Previous Seasons archive.** A new frozen store `snapshots/seasons/<season-key>/<slug>.json` holds exactly one
   snapshot per league for a past season (e.g. `snapshots/seasons/spring-2026/spring-sundays.json`). The Standings tab
   gains a collapsible "Previous Seasons" section that renders the same pill-row + standings table against a selected
   past season's snapshots.
3. **Blob purge (Spring 2026).** A one-off `archive-season` operation freezes each Spring active snapshot into the
   seasons store, then deletes Spring's `active/` copy and all of its `archive/` rollback copies from Vercel Blob,
   leaving exactly one frozen copy per Spring league.

In scope:

- New port methods + fs/blob adapter implementations for the seasons store and the promote/purge operation.
- New `archive-season` CLI entry + `mise run archive-season` task.
- New domain helpers for season keys/labels/grouping.
- Standings UI: extract a reusable browser; add the collapsible Previous Seasons section.
- App data loading in [`page.tsx`](/src/app/page.tsx) to load season archives alongside active snapshots.
- Summer source list.
- Unit tests for the new store methods and domain helpers.

Out of scope (non-goals):

- Modifying the committed [`data/snapshots/`](/data/snapshots/) tree (decision: **purge blob only**). Local dev fidelity
  is achieved via unit tests plus a temporary, uncommitted local seed during verification.
- URL/`localStorage` persistence of the Previous Seasons selection. It uses local component state for v1 (documented
  deviation). Current-season standings keep their existing `?league`/`?division` URL contract.
- An admin-UI button for archiving a season. The CLI is the operational surface for v1.
- Fall 2026. Only Summer (live) and Spring (archived) are handled now; the seasons model generalizes to Fall later.
- Pruning the seasons store or multi-season retention policy beyond "one snapshot per league per season".

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v6)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md) (v2)
- [/docs/specs/technical/snapshot-storage.md](/docs/specs/technical/snapshot-storage.md) (v1)
- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md)
- [/docs/specs/technical/runtime-ingestion.md](/docs/specs/technical/runtime-ingestion.md)
- [/docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)
- [/docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md)
- [/docs/specs/experience/ui-guidelines.md](/docs/specs/experience/ui-guidelines.md)

## Spec Coverage Checklist

(Spec text updated in the backport step.)

- [x] `data-snapshots.md` documents the `seasons/<season-key>/<league-slug>.json` frozen layout and that a season entry
      is a single immutable snapshot per league (distinct from rollback `archive/`).
- [x] `snapshot-storage.md` documents the new port methods (`listSeasonKeys`, `listSeasonSnapshots`,
      `writeSeasonSnapshot`, `promoteActiveToSeason`) across both adapters, and the promote-and-purge semantics
      (non-atomic, best-effort, additive-to-seasons then delete-from-active/archive).
- [x] `schedule-viewer.md` Standings-view section documents the collapsible "Previous Seasons" subsection: season picker
      (when >1), reused pill-row + table, local (non-URL) selection state.
- [x] `spreadsheet-ingestion.md` and the `LEAGUE_SOURCES` header comment reflect that the live source set is Summer 2026
      (Spring is archived, not ingested). `runtime-ingestion.md` needed no change — it references `LEAGUE_SOURCES`
      generically.
- [x] `developer-commands.md` lists `mise run archive-season -- --season <session>-<year> [--dry-run]`.
- [x] `domain-glossary.md` gains "Season", "Previous Seasons", and "Season archive CLI" rows mapping term → code/UI.

## Plan

### Approach

A "season" is `(session, year)`, keyed as `"<session>-<year>"` (e.g. `spring-2026`). The live season lives in `active/`
exactly as today; past seasons live in a parallel, read-mostly `seasons/` store, one frozen snapshot per league. The app
loads both: `active/` drives every live view, `seasons/` feeds only the Standings tab's Previous Seasons section. The
Spring→seasons migration and the blob purge are a single port operation (`promoteActiveToSeason`) invoked once via a new
CLI, run against the Blob backend.

Because the standings computation ([`buildStandings`](/src/shared/domain/standings.ts),
[`listStandingsOptions`](/src/shared/domain/standings.ts)) already operates on an arbitrary `Snapshot[]`, the Previous
Seasons UI reuses it unchanged by passing a past season's snapshot array.

### Files touched

**Storage port + adapters**

- Edit [/src/backend/runtime/adapters/snapshots/port.ts](/src/backend/runtime/adapters/snapshots/port.ts):
  - Add `PromoteResult { seasonPath: string | null; deletedActive: boolean; deletedArchiveCount: number }`.
  - Extend `SnapshotRepo` with:
    - `listSeasonKeys(): Promise<string[]>`
    - `listSeasonSnapshots(seasonKey: string): Promise<Snapshot[]>`
    - `writeSeasonSnapshot(seasonKey: string, snapshot: Snapshot): Promise<string>`
    - `promoteActiveToSeason(seasonKey: string, slug: string): Promise<PromoteResult>`
- Edit [/src/backend/runtime/adapters/snapshots/fs.ts](/src/backend/runtime/adapters/snapshots/fs.ts): implement the
  four methods under `<root>/seasons/<seasonKey>/<slug>.json`. `promoteActiveToSeason`: read `active/<slug>.json` →
  write season file → delete active file → `rm -rf archive/<slug>/` (counting entries first) → return counts. No-op
  (nulls/zero) if no active snapshot exists.
- Edit [/src/backend/runtime/adapters/snapshots/blob.ts](/src/backend/runtime/adapters/snapshots/blob.ts): same four
  methods under `snapshots/seasons/<seasonKey>/<slug>.json`, using `list`/`put`/`del`. `promoteActiveToSeason` lists and
  `del`s every `snapshots/archive/<slug>/*` entry and the active file. Reuse existing `writeJson`/`readJson` helpers.
- Edit [/src/backend/runtime/adapters/snapshots/index.ts](/src/backend/runtime/adapters/snapshots/index.ts): re-export
  `PromoteResult` type. No factory change.

**Domain helpers**

- New [/src/shared/domain/seasons.ts](/src/shared/domain/seasons.ts):
  - `seasonKeyFor(session, year): string` → `` `${session}-${year}` ``.
  - `seasonLabel(session, year): string` → e.g. `"Spring 2026"` (capitalized session + year).
  - `interface SeasonArchive { key; session; year; label; snapshots: Snapshot[] }`.
  - `buildSeasonArchives(byKey: Map<string, Snapshot[]>): SeasonArchive[]` — derives session/year from each group's
    first snapshot, sorts **newest-first** by `year desc` then session order (`fall > summer > spring`).

**App data loading**

- Edit [/src/app/page.tsx](/src/app/page.tsx): after `listActive()`, read season keys and their snapshots, build
  `SeasonArchive[]` via `buildSeasonArchives`, and pass `seasons` into `<ViewerApp>`.

**UI**

- Edit [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx): accept `seasons: SeasonArchive[]`; forward to
  `<StandingsView seasons={seasons} … />`. No view-mode or URL-param changes.
- Edit [/src/components/standings-view.tsx](/src/components/standings-view.tsx):
  - Extract the current pill-row + `StandingsTable` body into a reusable
    `StandingsBrowser({ snapshots, selectedLeagueSlug, selectedDivision, onSelect })`.
  - `StandingsView` renders the current-season `StandingsBrowser` (still driven by the existing props/URL state), then a
    new `<PreviousSeasons seasons={seasons} />` below it (only when `seasons.length > 0`).
  - `PreviousSeasons`: a collapsible section (button toggling `open`) whose body renders a season selector (pills, only
    when `seasons.length > 1`) and a `StandingsBrowser` for the selected season, with `{leagueSlug, division}` held in
    local `useState` (defaulting to the newest season and no selected pill). Styling reuses existing token classes (teal
    active pills, neutral borders) per `ui-guidelines.md`; no new colors.

**Live source list**

- Edit [/src/backend/logic/core/league-sources.ts](/src/backend/logic/core/league-sources.ts): replace the six
  `spring-*` entries with the six Summer 2026 entries (IDs below), update the header comment. `defaultDivision` carried
  over from the matching spring day, pending dry-run confirmation:

  | slug              | day       | sheetId                                        | defaultDivision  |
  | ----------------- | --------- | ---------------------------------------------- | ---------------- |
  | summer-sundays    | sunday    | `1IL4qeqYisQ4SHbbl_rmh05CqAYFJjKh5ZleRVTcOOw0` | (none; B/BB/BBB) |
  | summer-mondays    | monday    | `14C1Y-viYvpRpBOu90Hw-hJZhWBcCnOnFPKYdbNUE4TU` | B                |
  | summer-tuesdays   | tuesday   | `1x_gDvpqjBgsudqfKugo524xEOKdq2WDRQnctYfezRPg` | A                |
  | summer-wednesdays | wednesday | `1mKil0nE9rx1NIhzKAC0eTgEOm48PHdgteZ6UmIymeEM` | BB               |
  | summer-thursdays  | thursday  | `1VO0KAPeyxRNzvoqconBpQXgMWTfYwLkdq_3eih6bJCk` | A                |
  | summer-fridays    | friday    | `1Hsjl4hB3ca5XrpYPWNJy4MBdXDzeKJG9_LXpm4yf5J8` | B                |

  All six confirmed to export valid XLSX (HTTP 200) as of 2026-07-06.

**Migration CLI**

- New [/src/backend/season-archive.entry.ts](/src/backend/season-archive.entry.ts): mirrors
  [`ingest.entry.ts`](/src/backend/ingest.entry.ts). Args `--season <session>-<year>` (required) and `--dry-run`.
  Resolves the repo via `resolveSnapshotRepo()` (so `SNAPSHOT_STORAGE=blob` targets prod Blob). Lists active snapshots,
  filters those whose `seasonKeyFor(session, year)` matches `--season`, and for each calls `promoteActiveToSeason` (or,
  in dry-run, reports the active + archive-entry counts that would be frozen/purged). Prints a summary; exits non-zero
  on any failure.
- Edit [/package.json](/package.json): add `"archive-season": "tsx src/backend/season-archive.entry.ts"`.
- Edit [/mise.toml](/mise.toml): add an `archive-season` task mirroring the `ingest` task's `usage` arg passthrough.

**Tests**

- New [/src/tests/unit/season-store.test.ts](/src/tests/unit/season-store.test.ts) (fs adapter, temp dir):
  `writeSeasonSnapshot` + `listSeasonKeys` + `listSeasonSnapshots` round-trip; `promoteActiveToSeason` writes the season
  file, deletes the active file, deletes all archive entries, and reports counts; promote with no active returns
  `{ seasonPath: null, deletedActive: false, deletedArchiveCount: 0 }`.
- New [/src/tests/unit/seasons.test.ts](/src/tests/unit/seasons.test.ts): `seasonKeyFor`/`seasonLabel` formatting;
  `buildSeasonArchives` groups and sorts newest-first across mixed sessions/years.

### Cutover runbook (operational, post-merge)

Independent slugs mean order is flexible, but to avoid an empty-active window:

1. Deploy the code (summer sources + seasons feature).
2. Trigger an ingest (admin UI or cron) → populates `active/summer-*.json` in Blob.
3. `SNAPSHOT_STORAGE=blob BLOB_READ_WRITE_TOKEN=… pnpm run archive-season -- --season spring-2026 --dry-run`, review,
   then re-run without `--dry-run`. Freezes Spring into `seasons/spring-2026/`, deletes Spring `active/` + `archive/`.
4. Verify: live views show Summer; Standings → Previous Seasons shows Spring 2026.

### Edge cases

- **Empty seasons store** (before any archive): `listSeasonKeys` returns `[]`; `page.tsx` passes `seasons: []`; Previous
  Seasons section is not rendered.
- **Re-running `archive-season`**: idempotent — `writeSeasonSnapshot` overwrites; a second run finds no matching active
  snapshots (already purged) and reports zero promotions.
- **Season group with an unexpectedly mixed session/year**: `buildSeasonArchives` derives identity from the group's
  first snapshot; groups are keyed by directory so this cannot mix in practice.
- **Non-atomic promote**: matches existing `restoreArchive` semantics — season file is written before active/archive are
  deleted, so a mid-failure never loses data.
- **Now/Team views**: only read `active/`, so archived Spring never leaks into them — the intended behavior.
- **Multi-session dropdown**: with only Summer in `active/`, each day has one session, so the existing session dropdown
  stays hidden.

### Test strategy

Pure-domain + fs-adapter unit tests (above) are authoritative. Manual smoke during verification: temporarily seed an
uncommitted local `data/snapshots/` (summer `active/` via `mise run ingest`, a `seasons/spring-2026/` dir from the
current spring actives), run `mise run dev`, confirm Summer drives live views and Spring appears under Previous Seasons,
then `git checkout -- data/` to discard the seed (keeps the committed tree untouched per decision).

### Acceptance criteria

- [x] `LEAGUE_SOURCES` lists the six Summer 2026 leagues; `pnpm run ingest -- --dry-run` parses all six (teams
      42/18/18/18/17/12).
- [x] fs + blob adapters implement `listSeasonKeys`, `listSeasonSnapshots`, `writeSeasonSnapshot`,
      `promoteActiveToSeason`; new fs-adapter tests pass (4).
- [x] `pnpm run archive-season -- --season spring-2026 --dry-run` reports the six Spring leagues and their archive
      counts (Sunday 10, Wednesday 7, others 6) without mutating anything.
- [x] Standings tab renders a collapsible "Previous Seasons" section (hidden when no seasons exist) that shows a Spring
      2026 standings table using the reused pill-row + table (verified in-browser).
- [x] Live Team / Now / Standings views reflect only what is in `active/`; archived Spring lives solely in the seasons
      store and never leaks into them (by construction — those views read `listActive()` only).
- [x] Quality gates pass: `mise run lint`, `mise run typecheck`, `mise run fmt-check`, `mise run test` (136 tests).

### Assumptions / defaults chosen

- Summer `defaultDivision` values mirror the corresponding Spring day; confirmed/adjusted via `--dry-run` before commit.
- Previous Seasons selection is local component state, not URL/`localStorage` (v1). Recorded as a deviation.
- Committed `data/snapshots/` is left untouched; local verification uses an uncommitted seed (per "purge blob only").
- Season sort is newest-first with session order `fall > summer > spring` within a year.

## Execution Notes

- Summer sheet IDs were scraped from the public league page
  (`https://www.thescoregr.com/volleyball/beach-volleyball-leagues/`) and each verified to export a valid XLSX
  (HTTP 200) before wiring. `pnpm run ingest -- --dry-run` parses all six.
- **Source-data anomaly (not a code issue):** `summer-thursdays` (17 teams) has 14 matches referencing a "team 8" that
  is absent from that sheet's roster block, so the parser emits `references unknown team 8` anomalies. This reflects the
  current state of the Summer Thursday spreadsheet, not a parsing defect; it will resolve when the league corrects the
  sheet. Flagged for Kelsey.
- Verification of the destructive `archive-season` path against the committed `data/snapshots/` fs was intentionally
  **not** run (the auto-mode guardrail correctly blocked it per the "purge blob only" decision). The promote/purge logic
  is instead covered by `season-store.test.ts` (temp-dir fs) and by the CLI `--dry-run` against real committed Spring
  data (correct match set + archive counts).
- The Previous Seasons UI was verified in a running dev server by **additively** copying the Spring actives into a local
  `data/snapshots/seasons/spring-2026/` (untracked) and driving the Standings tab with Playwright — the collapsible
  expands to a "Spring 2026" archive with its reused pill row and standings table. The seed and all byproducts were
  removed afterward with `git checkout -- data/ && git clean -fd data/`; the committed tree is untouched.
- Spec backport completed: updated `data-snapshots.md` (v3), `snapshot-storage.md` (v2), `schedule-viewer.md` (v7),
  `spreadsheet-ingestion.md`, `developer-commands.md`, and `domain-glossary.md` (v5). `runtime-ingestion.md` needed no
  change (it references `LEAGUE_SOURCES` generically).

## Deviations

- Previous Seasons selection (which season / league / division) is held in local component state, not persisted to the
  URL or `localStorage`. This diverges from the current-standings view's `?league`/`?division` URL contract and was
  chosen to keep v1 scope tight; it can be promoted to shareable query params later.
- The committed `data/snapshots/` tree was deliberately left as Spring 2026 (decision: "purge blob only"). As a result
  the repo's local-dev default still shows Spring as active until a real cutover populates the Blob store; the seasons
  feature is exercised locally only via unit tests or a throwaway seed.

## Status

Done

(Implementation, tests, and spec backport are complete and verified. The production cutover against Vercel Blob — ingest
Summer, then `archive-season --season spring-2026` — remains an operational step for the deploy, documented in the
Cutover runbook above.)
