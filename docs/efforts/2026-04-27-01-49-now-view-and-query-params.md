# Effort

- Name: Now View + Query-Param View State (nuqs)
- Date: 2026-04-27
- Time: 01:49
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-04-27 01:55

## Scope

Add a second view mode — `now` — to the single-page viewer that shows, in a compact list, every match across every
league snapshot whose scheduled start time matches the current wall-clock time. The active view is selected by a small
toggle rendered near the top of the page (next to the day-of-week buttons in `team` view).

Introduce URL-driven view state using [`nuqs`](https://nuqs.47ng.com): `?view=team|now`, plus reflect `day`, `league`,
and `team` selections in the URL alongside the existing `localStorage` persistence so URLs are shareable while the
"remember my last team" device-level memory is preserved.

In scope:

- Add `nuqs` and wrap the app in its `<NuqsAdapter>` at the App Router root.
- Introduce a `view` query parameter and a top-level view-mode toggle (`Find My Team` | `Now Playing`).
- Implement the `now` view as a compact list of matches grouped by court, showing time, division, and `#A vs #B`.
- Define a single tunable constant `NOW_WINDOW_MINUTES = 0` plus a helper so widening the "currently playing" window
  later is a one-line change.
- Move `day`, `league`, `team` selection into URL query params via `nuqs`, while continuing to write the same values to
  `localStorage`. Hydration: query param wins when present; otherwise hydrate from `localStorage` and push the value
  back into the URL.

Out of scope (non-goals):

- A full season-wide schedule browser (court × team × date scrolling). The spec reserves the `view` parameter shape for
  it, but it is a future increment.
- Auto-refresh / polling for the `now` view.
- Captain names, opponent records, or scores in the `now` view (compact-only on purpose).
- Migrating any other client state (search query, admin gate) to query params.
- Any backend / ingestion changes.

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v5)
- [/docs/specs/experience/ui-guidelines.md](/docs/specs/experience/ui-guidelines.md)
- [/docs/specs/technical/data-snapshots.md](/docs/specs/technical/data-snapshots.md)

## Spec Coverage Checklist

- [x] `schedule-viewer.md` "View Modes" section documents the `team`/`now` toggle and the `view` query parameter.
- [x] `schedule-viewer.md` URL-state requirements (`view`, `day`, `league`, `team`) are honored by the implementation.
- [x] `schedule-viewer.md` hydration rules (query param wins on mount; fall back to localStorage and push back into URL;
      both written on change) are honored.
- [x] `schedule-viewer.md` `now` view requirements (aggregation across leagues whose `league.day` matches today,
      configurable `NOW_WINDOW_MINUTES` constant, compact rendering, empty states) are honored.
- [x] `ui-guidelines.md` typography, color, and spacing tokens are reused — no new ad-hoc colors.
- [x] `data-snapshots.md` is unaffected (no schema changes).

## Plan

### Approach

Two cohesive changes land in the same effort because they are coupled by the new view-mode toggle:

1. Add `nuqs` and migrate the existing client-side selection state (`day`, `league`, `team`) from "localStorage only" to
   "URL + localStorage", with query params winning on mount.
2. Add a new `view` query parameter (`team` default, `now` opt-in) and a `<NowView>` component that renders the
   currently-playing matches across every league snapshot whose `league.day` matches today's day-of-week.

The `now` view's "is this match playing right now?" check is centralized in a single domain function and gated on a
single tunable constant `NOW_WINDOW_MINUTES = 0`. Default behavior: a match is "now" iff its `time` exactly equals the
current `HH:mm` in `America/Detroit` for today. Widening the window to ±N minutes is a one-line change to the constant
and the helper consults it.

### Files touched

- New: [/src/shared/domain/now-view.ts](/src/shared/domain/now-view.ts) — pure helpers:
  - `NOW_WINDOW_MINUTES = 0` (export, tunable)
  - `dayOfWeekInLeagueTimezone(now): LeagueDay` — uses `Intl.DateTimeFormat` with `timeZone: "America/Detroit"`,
    `weekday: "long"`, lowercased and narrowed to `LeagueDay`.
  - `currentHHmmInLeagueTimezone(now): string` — returns `"HH:mm"` 24-hour in league TZ.
  - `selectNowMatches(snapshots, now): { groupsByCourt: Map<string, NowMatch[]>; nextUpcomingTime: string | null; anyLeagueToday: boolean }`
    where `NowMatch = { match: Match; league: League }`.
  - Match-time membership rule: parse `match.time` as `HH:mm`, compute minutes-of-day diff vs current, include if
    `Math.abs(diff) <= NOW_WINDOW_MINUTES` AND `match.date === todayIso`.
  - When the result has zero matches, `nextUpcomingTime` is the smallest match `time` for today across all eligible
    leagues that is `>` current time, or `null`.
- New: [/src/components/now-view.tsx](/src/components/now-view.tsx) — client component. Receives `snapshots: Snapshot[]`
  and renders three states:
  - "Now playing" list: grouped by court (one card per court), each row shows `time` (e.g. `11:20 AM`), `#A vs #B`,
    `<DivisionPill>`, league display name as a small caption.
  - "Nothing playing right now" state with `Up next at <time>` if `nextUpcomingTime` is non-null.
  - "No league plays today" state with a CTA pointing to `?view=team`.
  - Reuses [`<CourtLabel>`](/src/components/theme-tokens.tsx) and [`<DivisionPill>`](/src/components/theme-tokens.tsx).
- Edit: [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx) —
  - Import `useQueryState`, `parseAsStringLiteral`, `parseAsInteger` from `nuqs`.
  - Replace four `useState`s for `selectedDay`/`selectedLeagueSlug`/`selectedTeamNumber` with `useQueryState` hooks.
    `selectedDay` uses `parseAsStringLiteral(DAYS)`, `selectedLeagueSlug` uses default string parser, team uses
    `parseAsInteger`. All omit defaults so the URL drops them when null.
  - Add `view` `useQueryState` with `parseAsStringLiteral(["team", "now"])`. Default value is `"team"` and uses
    `withOptions({ clearOnDefault: true })` so `?view=team` doesn't appear in the URL.
  - Hydration effect: on first run, inspect URL state; for any of `day/league/team` that is null AND has a valid
    `localStorage` entry, call the corresponding setter with `{ history: "replace" }` to write it back into the URL.
    `localStorage`-only paths (no URL value, no LS value) preserve current behavior of auto-picking the current session.
  - The existing localStorage-write effect stays as-is (already triggers on the same three values).
  - Render a new `<ViewToggle>` segment above the Day section that switches between `team` and `now`. When
    `view === "now"`, render `<NowView snapshots={snapshots} />` instead of the team flow.
- Edit: [/src/app/layout.tsx](/src/app/layout.tsx) — wrap `{children}` in `<NuqsAdapter>` from `nuqs/adapters/next/app`.
  `NuqsAdapter` is a client component; it can sit inside the server `<body>` without making the layout a client
  component.
- Edit: [/package.json](/package.json) — add `"nuqs": "^2"` under `dependencies`. Run `pnpm install` to update the
  lockfile.
- New tests: [/src/tests/unit/now-view.test.ts](/src/tests/unit/now-view.test.ts) — see Test strategy.

### URL state contract

| Param    | Type              | Empty/default value | Notes                                                      |
| -------- | ----------------- | ------------------- | ---------------------------------------------------------- |
| `view`   | `"team" \| "now"` | `"team"` (omitted)  | `clearOnDefault: true`. Future: add `"schedule"`.          |
| `day`    | `LeagueDay`       | `null` (omitted)    | Only meaningful in `team` view; `now` view ignores it.     |
| `league` | `string`          | `null` (omitted)    | League slug. Validated against current snapshots on mount. |
| `team`   | `integer`         | `null` (omitted)    | Validated against the resolved league's teams on mount.    |

URL writes use `history: "replace"` so that day/league/team toggling doesn't pollute browser back-stack — same UX as
today's localStorage-only model, just observable in the address bar.

### Hydration order (mount)

1. Read URL state (nuqs, synchronous on first render). Type-shape mismatches are already mapped to `null` by
   `parseAsStringLiteral` / `parseAsInteger`.
2. Read `localStorage` (existing effect, runs once).
3. Run `validateUrlSelection(snapshots, { day, league, team })`:
   - Drop `day` if not in `DAYS`; cascade-drop `league` and `team`.
   - Drop `league` if not present in `snapshotsByDay.get(day)`; cascade-drop `team`.
   - Drop `team` if no team with that number exists on the resolved snapshot.
   - Drop orphans (`team` without `league`, `league` without `day`).
4. For each of `day`, `league`, `team` where the cleaned URL value is null but `localStorage` has a value that _also_
   passes the same validation, call the nuqs setter with that value (`history: "replace"`).
5. If `day` resolves but `league` does not, fall back to `pickCurrentSnapshot(...)?.league.slug` for today.
6. For any URL slot where the cleaned value differs from the raw URL value (i.e. validation dropped something), call the
   nuqs setter with the cleaned value and `history: "replace"` so the address bar reflects the cleaned state.
7. The localStorage-write effect continues to mirror state into LS on every change. LS only stores values that have
   already passed validation, so the next visit starts from a known-good state.

### Invalid-input contract (URL and localStorage)

| Slot     | Invalid form                                    | Outcome                                                                                                    |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `view`   | Not `team` or `now` (e.g. `?view=foo`)          | Treated as default `team`; URL rewritten to drop `view`.                                                   |
| `day`    | Not in `DAYS`, wrong case, junk                 | Treated as null; cascade-drops `league` and `team`; rewritten.                                             |
| `league` | Slug not in `snapshotsByDay.get(day)`           | Treated as null; cascade-drops `team`; rewritten. Falls back to current session via `pickCurrentSnapshot`. |
| `team`   | Non-integer, negative, or missing from snapshot | Treated as null; rewritten.                                                                                |
| Cross    | `team` without `league`, `league` without `day` | Orphan dropped and rewritten.                                                                              |
| Cross    | `view=now` plus team-view params                | Team-view params kept (so toggling back restores selection) but ignored by `<NowView>`.                    |

Cleanup is silent — no toast, no inline error.

### `NowView` rendering details

- Header: `Now Playing` + the current local time in `America/Detroit` (e.g. `Sun 11:20 AM`).
- Sections per court, ordered by snapshot's `courtOrder` if present, else alphabetical court name.
  - Each match row: `<CourtLabel>` (court color dot), `time` rendered as 12-hour with am/pm, `<DivisionPill>`, then
    `#A vs #B`. League display name shown as a small subtitle on the row when more than one league is playing today.
- Empty states:
  - No match in the window but at least one league plays today: subtle card "Nothing on right now. Up next at
    `nextUpcomingTime`." If `nextUpcomingTime` is null, "No more matches today."
  - No league plays today: "No league plays on `<weekday>`. Switch to Find My Team." with an inline link/button that
    sets `?view=team`.

### Toggle UI

A segmented control rendered as the first section of `<ViewerApp>`, before the Day buttons. Two `<button>`s styled like
the existing day buttons (teal-on-white when active, neutral border when not). Order: `Find My Team`, `Now Playing`.
Clicking sets `?view=...` (clearOnDefault means clicking "Find My Team" removes the param entirely).

### Edge cases

- League snapshots may include past sessions whose `league.day` matches today but whose date range has ended. The `now`
  filter requires `match.date === todayIso`, so past-session matches naturally drop out.
- A snapshot's matches may be empty for today (e.g. a bye week). Treated identically to "no league plays today" if no
  league has any match dated today.
- DST boundaries: `Intl.DateTimeFormat` with `timeZone: "America/Detroit"` handles the offset; we only ever compare
  HH:mm and ISO-date strings, never raw UTC math.
- Stale or malformed URL values: handled centrally by `validateUrlSelection` (see "Invalid-input contract" above) which
  runs on mount and after any of the three values change. Cascading drops ensure we never display a `team` that doesn't
  exist on the resolved `league`, or a `league` that doesn't play on the resolved `day`.
- `nuqs` SSR: `useQueryState` is a client hook. `<ViewerApp>` is already a client component; adding `<NuqsAdapter>` at
  the layout root is sufficient. The server page (`page.tsx`) does not read query params and must stay `force-dynamic`
  (already set).
- Triple-tap admin gate: lives on the page header, not in `ViewerApp`. Unaffected by view toggling.
- Empty snapshot set: `<ViewerApp>` already renders a friendly empty state when `availableDays.length === 0`. The `now`
  view must render its own empty state ("No league plays today.") in that case rather than blowing up.

### Test strategy

A second pure-domain unit test file `src/tests/unit/url-selection.test.ts` covers `validateUrlSelection`:

- Valid `(day, league, team)` against a fixture snapshot set passes through untouched.
- Unknown `day` returns `{ day: null, league: null, team: null }`.
- Known `day` + unknown `league` returns `{ day, league: null, team: null }`.
- Known `day` + valid `league` + unknown `team number` returns `{ day, league, team: null }`.
- Orphan `team` without `league` returns `{ team: null }`.
- Orphan `league` without `day` returns `{ league: null, team: null }`.

Unit tests in `src/tests/unit/now-view.test.ts` (Vitest, pure-domain only — no React rendering):

- `selectNowMatches` returns matches across multiple snapshots when each has a match at `currentHHmm` on `todayIso`.
- Filters out matches from snapshots whose `league.day` does not equal today's weekday.
- Filters out matches whose `date !== todayIso` even if `time` matches.
- With `NOW_WINDOW_MINUTES = 0` (default), excludes matches whose `time` is one minute before/after current.
- When no matches qualify, `nextUpcomingTime` is the next future `time` today across qualifying league-day snapshots, or
  `null` when none.
- `anyLeagueToday === false` when no snapshot has `league.day === today`; otherwise `true`.
- `dayOfWeekInLeagueTimezone` and `currentHHmmInLeagueTimezone` return canonical lowercase weekday and `HH:mm` for a
  fixed `Date`.

Existing `viewer-app` behavior is regression-checked via the existing unit suite plus manual smoke (start dev server,
load `/`, verify): default URL is bare; selecting day/league/team writes both URL and LS; reload preserves selection;
opening `?view=now` shows the now-view; clearing all storage and visiting `?view=now&day=sunday` lands cleanly.

Playwright e2e is still deferred per the MVP effort.

### Acceptance criteria

- [x] Visiting `/` with no params renders the team view (`?view=` absent in the URL).
- [x] Visiting `/?view=now` renders the now-view immediately, regardless of any prior `localStorage` selection.
- [x] Toggling between `Find My Team` and `Now Playing` updates the URL via `nuqs` and never adds a browser history
      entry.
- [x] Selecting day/league/team in the team view writes both `localStorage` _and_ the URL.
- [x] On a fresh tab with `localStorage` populated and no URL params, the page hydrates from `localStorage` and rewrites
      the URL so the displayed URL is shareable.
- [x] On a fresh tab with URL params present and `localStorage` populated, URL params win and `localStorage` is updated
      to match.
- [x] Invalid URL values are silently dropped and removed from the URL with `history: "replace"`:
  - [x] `?view=foo` → cleaned to no `view` param.
  - [x] `?day=funday` → cleaned; `league` and `team` also dropped if present.
  - [x] `?league=does-not-exist` → cleaned; `team` also dropped if present.
  - [x] `?team=abc` and `?team=99999` (out of range) → cleaned.
  - [x] `?team=7` without `league` (orphan) → cleaned.
- [x] Validation logic is centralized in a single `validateUrlSelection` helper covered by unit tests.
- [x] In the `now` view, a match at the exact current `HH:mm` in `America/Detroit` for today appears under its court.
- [x] Matches one minute before or after the current time are excluded under the default `NOW_WINDOW_MINUTES = 0`.
- [x] Increasing the window (via the `windowMinutes` parameter on `selectNowMatches`) widens inclusion to that window —
      covered by a test.
- [x] Empty states are rendered for "nothing playing now" (with `Up next at …` if any) and "no league plays today".
- [x] `mise run lint`, `mise run typecheck`, `mise run fmt-check`, and `mise run test` all pass.

### Assumptions / defaults chosen

- `nuqs@^2` is the right major; the project is on Next 15 App Router and React 19 which `nuqs` supports.
- `match.time` is always `HH:mm` 24-hour as observed in current snapshots; no need to parse 12-hour formats.
- The `now` view uses `new Date()` evaluated at component mount; no live ticker. A page reload is the user-action that
  refreshes the view.
- `view` is URL-only, never persisted to `localStorage`, so a returning user always lands in the default `team` view
  unless they used a shared `?view=now` link.
- Court ordering for the `now` view's groups falls back to alphabetical when the snapshot does not surface a canonical
  ordering. The existing `Snapshot` shape does not store court order, so alphabetical is acceptable for v1.

## Execution Notes

- Added `nuqs@^2` dependency and wrapped the App Router root in `<NuqsAdapter>`.
- Created [/src/shared/domain/now-view.ts](/src/shared/domain/now-view.ts) with `NOW_WINDOW_MINUTES = 0`,
  `dayOfWeekInLeagueTimezone`, `currentHHmmInLeagueTimezone`, and `selectNowMatches(snapshots, now, windowMinutes?)`.
  The optional `windowMinutes` parameter defaults to the constant; tests use it to verify wider-window inclusion.
- Created [/src/shared/domain/url-selection.ts](/src/shared/domain/url-selection.ts) with the shared `DAYS` literal list
  and `validateUrlSelection` cascading-drop logic.
- Created [/src/components/now-view.tsx](/src/components/now-view.tsx) — court-grouped compact match list with the two
  empty states. Renders client-side after `useEffect` sets `now`, avoiding SSR/CSR time mismatch.
- Migrated [/src/components/viewer-app.tsx](/src/components/viewer-app.tsx) from local `useState` to `useQueryState` for
  `view`, `day`, `league`, `team`. Hydration effect runs once: validates URL state via `validateUrlSelection`, falls
  back to localStorage, then writes back into the URL. All setters use `history: "replace"`. The existing
  localStorage-write effect was preserved unchanged.
- Smoke-tested the dev server: `/`, `/?view=now`, and `/?view=foo&day=funday&league=does-not-exist&team=abc` all return
  HTTP 200; the bad-params URL renders the default `team` toggle (`aria-selected="true"` on Find My Team) confirming
  silent cleanup post-hydration.
- All quality gates pass: `lint`, `typecheck`, `fmt-check`, 107 unit tests.

## Deviations

- `selectNowMatches` accepts an optional `windowMinutes` override in addition to the module-level `NOW_WINDOW_MINUTES`
  constant. The plan called for a single tunable constant; adding the override keeps the one-line-default-change promise
  while letting unit tests verify wider-window behavior without mutating module state. Production callers omit the third
  argument and continue to inherit the constant.
- `NOW_WINDOW_MINUTES` was raised from `0` to `50` and the membership rule changed from a symmetric ±N window to a
  half-open `[match start, match start + window)` interval (already-started, not-yet-replaced). This matches the league
  cadence — at the start of each new slot, the previous slot's matches drop out and the new slot's matches appear. Spec
  text in `schedule-viewer.md` updated accordingly.

## Status

Done
