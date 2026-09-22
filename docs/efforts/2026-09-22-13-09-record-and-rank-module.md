# Effort

- Name: One Record-and-Rank module
- Date: 2026-09-22
- Time: 13:09
- Plan Approved By: Kelsey Brennan
- Plan Approved At: 2026-09-22 13:09 UTC

## Scope

Top recommendation of the 2026-09-22 architecture review: Record and Rank were computed in three places
([src/shared/domain/stats.ts](/src/shared/domain/stats.ts),
[src/shared/domain/standings.ts](/src/shared/domain/standings.ts), and the unused
[src/backend/logic/core/record.ts](/src/backend/logic/core/record.ts) /
[src/backend/logic/core/rank.ts](/src/backend/logic/core/rank.ts)), and the two live ones disagreed on ties: Team detail
showed "Rank 3 of 12" where the Standings table showed "T-2" for the same team, against the glossary's "Tied teams share
a rank, shown as T-N".

In scope:

- One deep module in [src/shared/domain/standings.ts](/src/shared/domain/standings.ts): `computeStandings(snapshot)`
  returns the per-division tables and the same rows indexed by team number. Rows gain `divisionSize`.
- Team detail, the Standings table, the pill list, and the per-team report all read from it. Team detail and the report
  print the table's rank label ("Rank T-2 of 12 in BB").
- Delete `stats.ts`, `record.ts`, `rank.ts`, and their tests; port the "every played match counts" case.
- Ingestion invariant: a match that pairs teams from different divisions records an Anomaly.
- Spec corrections: Team detail rank wording, and removal of the inter-division sentence (see Deviations).

Out of scope: the other review candidates (snapshot store, League clock, Ingestion request, Viewer selection actions,
Team-detail view model, Admin read seam).

## Spec Set (Frozen)

- [/docs/specs/product/schedule-viewer.md](/docs/specs/product/schedule-viewer.md) (v9)
- [/docs/specs/technical/spreadsheet-ingestion.md](/docs/specs/technical/spreadsheet-ingestion.md) (v9)
- [/CONTEXT.md](/CONTEXT.md)

## Spec Coverage Checklist

- [x] Team detail's rank line uses the same label as the Standings table (T-N for ties, "Unranked" for 0-0).
- [x] The per-team report prints the same label.
- [x] Record counts every played match; rank is computed within the division only.
- [x] One computation per snapshot serves Team detail (own row + every opponent's record), the Standings table, and the
      pill list.
- [x] A cross-division match is recorded as an anomaly by `validateSnapshot`, with a test.
- [x] `stats.ts`, `record.ts`, `rank.ts` and their tests are gone; no production code imports them.
- [x] CONTEXT.md: a combined label is one division; teams only play within their division; Record counts all played
      matches.
- [x] Typecheck, lint, format check, and the full unit suite pass.

## Plan

1. TDD at the `computeStandings` seam in [src/tests/unit/standings.test.ts](/src/tests/unit/standings.test.ts): per-team
   lookup with tie label and division size; ported record case; one group per division.
2. TDD at the `validateSnapshot` seam in [src/tests/unit/validate.test.ts](/src/tests/unit/validate.test.ts):
   cross-division pairing anomaly.
3. TDD at the `buildReport` seam in
   [src/tests/unit/build-team-report.test.ts](/src/tests/unit/build-team-report.test.ts): tie label in the record line.
4. Move [src/components/team-detail.tsx](/src/components/team-detail.tsx) and
   [src/components/standings-view.tsx](/src/components/standings-view.tsx) onto `computeStandings` (typecheck is the
   gate; the node-only test policy has no seam for components).
5. Delete the dead modules and `buildStandings`; port its tests onto the one computation.
6. Update AGENTS.md repo surface, both specs, and CONTEXT.md.

## Execution Notes

- Plan approved in chat during the grilling session that followed the architecture review; the user chose the
  `implement` skill over the effort-plan loop, so this file was written alongside the implementation.
- Every checked-in snapshot (9,042 matches) was scanned before deciding Q3: zero cross-division matches exist, and
  combined divisions already arrive as one label.
- Team detail now memoizes one standings computation per snapshot and looks up every opponent from it, instead of
  recomputing all stats once per match row.
- Gates: `pnpm run typecheck`, `pnpm run lint`, `pnpm run fmt-check`, `pnpm run test` (188 tests) pass.

## Deviations

- The product spec said a team's record is computed "from BB teams only, even if they are scheduled to play a BBB team
  inter-division". Kelsey Brennan clarified that teams never play across divisions and that a combined label such as
  BB/BBB is one division, so the sentence described a non-case. Record keeps counting every played match (unchanged
  behaviour), the spec now says so, and the new ingestion invariant guards the assumption.
- The old `rank.ts` test asserted that ties are broken by team number; that contradicted the glossary and was dropped
  rather than ported.

## Status

Done
