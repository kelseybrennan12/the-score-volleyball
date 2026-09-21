# Effort

- Name: Viewer selection module behind today's behaviour
- Date: 2026-09-21
- Time: 17:55
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-21 17:55

## Scope

Implement GitHub issue #8 (part of PRD #6): move all Viewer selection state (URL + per-browser memory + validation +
default-league inference) behind a single deep module. The viewer reads and writes selection state only through a
`useViewerSelection` hook backed by a pure `resolveViewerSelection` function that the node-only test rig drives
directly.

In scope:

- New pure module [/src/shared/domain/viewer-selection.ts](/src/shared/domain/viewer-selection.ts): folds in the
  existing `validateUrlSelection` helper, adds the resolve function, the default-league helper, action planners, and the
  `DAYS` / `isLeagueDay` exports.
- New hook [/src/components/use-viewer-selection.ts](/src/components/use-viewer-selection.ts): binds the resolve
  function to `nuqs` query state and to a storage adapter (get/set/remove) defaulting to `localStorage`.
- Rewire [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx) to consume the hook; delete the mount-only
  hydration effect, the persistence effect, and the duplicated Day-selector rule.
- Delete [/src/shared/domain/url-selection.ts](/src/shared/domain/url-selection.ts) and migrate its tests into
  [/src/tests/unit/viewer-selection.test.ts](/src/tests/unit/viewer-selection.test.ts).

Out of scope (deferred to #9):

- Standings selection's own `standings` parameter. In this ticket the URL contract is unchanged: Standings still shares
  `league`, wired through the new `selectStandings` action exactly as today.
- Division validation, the transitional old-link fallback, and removing Team-search props from the Standings view.

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v8)
- [/CONTEXT.md](/CONTEXT.md)
- [/docs/specs/process/repo-layout.md](/docs/specs/process/repo-layout.md)

## Spec Coverage Checklist

- [x] The viewer has no direct query-state or local-storage access; all selection state comes from the hook.
- [x] The resolve function is pure and returns both the validated selection and the writes to make.
- [x] Storage is consulted only when the URL names none of day, league, team; hydration from storage produces URL
      writes.
- [x] Validation is derived on every render; write-backs occur only on mount and on actions, with history replacement.
- [x] `selectDay` sets the live League for today and clears the Team; `selectLeague` clears the Team; search-text
      changes clear the Team.
- [x] The old hydration and persistence effects and the Day-selector duplicate rule are gone.
- [x] The URL-validation helper is folded in and its tests migrate; the current-season helper and tests are untouched.
- [x] Resolve-function tests cover: URL beats storage; all-or-nothing storage fallback; storage hydration writes; the
      day → league → team cascade including orphans; default League by today; stale values dropped on a later render;
      each action's effect on the selection.
- [x] Lint, typecheck, format check, and the full unit suite pass.

## Plan

1. Create `viewer-selection.ts`:
   - Move `DAYS`, `isLeagueDay`, `RawSelection`, `ValidatedSelection`, and `validateUrlSelection` from
     `url-selection.ts`.
   - `pickDefaultLeagueSlug(snapshots, day, todayIso)` wrapping `pickCurrentSnapshot`.
   - `resolveViewerSelection({ snapshots, params, stored, todayIso })` → `{ selection, storageWrite }`:
     - `view` validated to `team|now|standings` (default `team`).
     - `standings` view: pass `day`/`league`/`team`/`division` through (view-aware — `league` is the Standings league,
       not day-validated), so browsing standings is unchanged this ticket.
     - `team`/`now` view: consult `stored` only when URL names none of day/league/team; run the day→league→team cascade;
       apply default-league when a day has no league; pass `division` through.
     - `storageWrite` derived from the resolved viewer selection.
   - Action planners: `planSelectDay`, `planSelectLeague`, `planSelectTeam`, `planSelectStandings`.
2. Create `use-viewer-selection.ts`: bind `nuqs` params + storage adapter; expose resolved selection + derived
   (`daySnapshots`, `selectedSnapshot`, `selectedTeam`) + the five actions. Mount effect hydrates + cleans up; actions
   write params (history replace) and persist.
3. Rewire `viewer-app.tsx` to the hook; delete both effects and the duplicated day rule.
4. Migrate tests into `viewer-selection.test.ts`; delete `url-selection.ts` + its test.
5. Run typecheck, lint, format check, unit tests.

## Execution Notes

- The frozen spec delta (v8) from ticket #7 lived on a sibling branch; cherry-picked it (`git cherry-pick -x 8282f2e`)
  onto this branch so the module builds on the approved contract.
- Pure module [/src/shared/domain/viewer-selection.ts](/src/shared/domain/viewer-selection.ts) folds in
  `validateUrlSelection` (unchanged logic), plus `resolveViewerSelection`, `pickDefaultLeagueSlug`, and the four action
  planners. `DAYS`, `isLeagueDay`, `VIEW_MODES`, and `ViewMode` now live here.
- Hook [/src/components/use-viewer-selection.ts](/src/components/use-viewer-selection.ts) derives the displayed
  selection every render (storage skipped), hydrates + cleans up once on mount (storage consulted), and persists on
  mount and on every write action. Storage is a `StorageAdapter` seam defaulting to `localStorage`.
- Local dev environment shipped only darwin-arm64 native binaries; installed matching linux-arm64 `@rollup`/`@esbuild`
  binaries into `node_modules` so Vitest runs. No manifest/lockfile change.
- Gates: `npm run typecheck`, `npm run lint`, `npm run fmt-check`, `npm run test` (169 tests) all pass.

## Deviations

- **Interim standings contract (by design, closed in #9).** Per #8 the URL contract is unchanged, so `selectStandings`
  still writes the shared `league` (plus `division`) and the resolve function has a view-aware branch that passes the
  Standings `league`/`division` through without day-validation. The frozen spec (v8) already describes the final
  `standings` parameter; code intentionally lags the spec here and #9 brings them together. Not backported — the spec is
  the deliberate target for the remaining ticket.
- **Persistence moved from an effect into the actions + mount.** The deleted persistence effect fired on any
  day/league/team change; the hook now persists at the same change points (mount hydration and each write action),
  preserving behaviour without a standalone effect.

## Status

Done
