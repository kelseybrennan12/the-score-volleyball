import type { Match, Snapshot, Team } from "@/shared/domain/snapshot";
import { computeStandings, listStandingsOptions, type StandingsRow } from "@/shared/domain/standings";
import { describe, expect, it } from "vitest";

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    schemaVersion: 1,
    ingestedAt: "2026-04-27T00:00:00Z",
    league: {
      slug: "spring-sundays",
      displayName: "Spring Sundays",
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "x",
    },
    teams: [],
    matches: [],
    ...overrides,
  };
}

function team(number: number, captain: string, division = "B"): Team {
  return { number, captain, division };
}

function played(
  teamA: number,
  teamB: number,
  winner: number,
  setsWinner: number,
  setsLoser: number,
  date = "2026-04-26",
): Match {
  return {
    date,
    time: "18:00",
    court: "Blue Ct",
    teamNumbers: [teamA, teamB],
    outcome: { status: "played", winnerTeamNumber: winner, setsWinner, setsLoser },
  };
}

/** Rows of one division's table, or `[]` when the snapshot has no such division. */
function divisionRows(snap: Snapshot, division: string): StandingsRow[] {
  return computeStandings(snap).divisions.find((g) => g.division === division)?.rows ?? [];
}

describe("computeStandings: per-division tables", () => {
  it("ranks teams by sets won desc, sets lost asc, with skip-rank ties labeled T-N", () => {
    const snap = makeSnapshot({
      teams: [team(1, "Alice"), team(2, "Bob"), team(3, "Cara"), team(4, "Dan")],
      matches: [
        // Team 1: 3-0 win, 3-0 win => 6-0
        played(1, 2, 1, 3, 0),
        played(1, 3, 1, 3, 0),
        // Team 2: 0-3, then 3-0 vs 4 => 3-3
        played(2, 4, 2, 3, 0),
        // Team 3: 0-3 from above, then 2-1 win vs 4 => 2-4
        played(3, 4, 3, 2, 1),
        // Team 4: 0-3 + 1-2 => 1-5
      ],
    });
    const rows = divisionRows(snap, "B");
    expect(rows.map((r) => [r.teamNumber, r.setsWon, r.setsLost, r.rankLabel])).toEqual([
      [1, 6, 0, "1"],
      [2, 3, 3, "2"],
      [3, 2, 4, "3"],
      [4, 1, 5, "4"],
    ]);
  });

  it("labels tied teams T-N and skips ranks (1, T-2, T-2, 4)", () => {
    const snap = makeSnapshot({
      teams: [team(1, "A"), team(2, "B"), team(3, "C"), team(4, "D")],
      matches: [
        // Team 1: 6-0 (two 3-0 wins)
        played(1, 4, 1, 3, 0),
        played(1, 2, 1, 3, 0),
        // Teams 2 and 3: both 3-3 (need to construct)
        played(2, 3, 2, 3, 0), // team 2 +3w, team 3 +3l
        played(3, 4, 3, 3, 0), // team 3 +3w, team 4 +3l
        // After: team 2 = 3-3 (3-0 from above + loss 0-3 to team 1), team 3 = 3-3, team 4 = 0-9
      ],
    });
    const rows = divisionRows(snap, "B");
    expect(rows.map((r) => [r.teamNumber, r.rankLabel, r.isTied])).toEqual([
      [1, "1", false],
      [2, "T-2", true],
      [3, "T-2", true],
      [4, "4", false],
    ]);
  });

  it("places teams with no played sets at the bottom unranked, sorted by team number", () => {
    const snap = makeSnapshot({
      teams: [team(7, "G"), team(2, "B"), team(5, "E")],
      matches: [played(2, 5, 2, 3, 0)],
    });
    const rows = divisionRows(snap, "B");
    expect(rows.map((r) => [r.teamNumber, r.rankLabel])).toEqual([
      [2, "1"],
      [5, "2"],
      [7, "—"],
    ]);
    expect(rows[2].rank).toBeNull();
  });

  it("only includes teams in the requested division", () => {
    const snap = makeSnapshot({
      teams: [team(1, "A", "B"), team(2, "B", "BB"), team(3, "C", "B")],
      matches: [played(1, 3, 1, 3, 0)],
    });
    const b = divisionRows(snap, "B");
    expect(b.map((r) => r.teamNumber)).toEqual([1, 3]);
    const bb = divisionRows(snap, "BB");
    expect(bb.map((r) => r.teamNumber)).toEqual([2]);
  });

  it("returns no rows when the division has no teams", () => {
    const snap = makeSnapshot({ teams: [team(1, "A", "B")] });
    expect(divisionRows(snap, "BB")).toEqual([]);
  });
});

describe("listStandingsOptions", () => {
  it("emits one option per (snapshot, division), labeled '<Day> <Division>'", () => {
    const sundaySnap = makeSnapshot({
      teams: [team(1, "A", "B"), team(2, "B", "BB"), team(3, "C", "BBB")],
    });
    const mondaySnap = makeSnapshot({
      league: {
        slug: "spring-mondays",
        displayName: "Spring Mondays",
        day: "monday",
        session: "spring",
        year: 2026,
        sourceSheetId: "y",
      },
      teams: [team(1, "X", "B"), team(2, "Y", "B")],
    });
    const options = listStandingsOptions([sundaySnap, mondaySnap]);
    expect(options).toEqual([
      { leagueSlug: "spring-sundays", division: "B", label: "Sunday B" },
      { leagueSlug: "spring-sundays", division: "BB", label: "Sunday BB" },
      { leagueSlug: "spring-sundays", division: "BBB", label: "Sunday BBB" },
      { leagueSlug: "spring-mondays", division: "B", label: "Monday B" },
    ]);
  });

  it("orders options by day of week regardless of input order", () => {
    const days: { day: "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday"; slug: string }[] = [
      { day: "friday", slug: "spring-fridays" },
      { day: "monday", slug: "spring-mondays" },
      { day: "thursday", slug: "spring-thursdays" },
      { day: "sunday", slug: "spring-sundays" },
      { day: "wednesday", slug: "spring-wednesdays" },
      { day: "tuesday", slug: "spring-tuesdays" },
    ];
    const snapshots = days.map(({ day, slug }) =>
      makeSnapshot({
        league: { slug, displayName: slug, day, session: "spring", year: 2026, sourceSheetId: "x" },
        teams: [team(1, "A", "B")],
      }),
    );
    const labels = listStandingsOptions(snapshots).map((o) => o.label);
    expect(labels).toEqual(["Sunday B", "Monday B", "Tuesday B", "Wednesday B", "Thursday B", "Friday B"]);
  });
});

describe("computeStandings: per-team lookup", () => {
  it("looks up any team's row by number, with division size counting unranked teams", () => {
    const snap = makeSnapshot({
      teams: [team(1, "A"), team(2, "B"), team(3, "C"), team(4, "D"), team(5, "E", "BB")],
      matches: [played(1, 2, 1, 3, 0), played(3, 4, 3, 3, 0)],
    });
    const { byTeam } = computeStandings(snap);
    expect(byTeam.get(1)).toMatchObject({ division: "B", setsWon: 3, setsLost: 0, rankLabel: "T-1", divisionSize: 4 });
    expect(byTeam.get(3)).toMatchObject({ rankLabel: "T-1", divisionSize: 4 });
    expect(byTeam.get(2)).toMatchObject({ setsWon: 0, setsLost: 3, rankLabel: "T-3", divisionSize: 4 });
    expect(byTeam.get(5)).toMatchObject({ division: "BB", rank: null, rankLabel: "—", divisionSize: 1 });
    expect(byTeam.get(99)).toBeUndefined();
  });

  it("counts every played match toward both teams' records and ignores unplayed ones", () => {
    const snap = makeSnapshot({
      teams: [team(1, "A"), team(2, "B"), team(3, "C")],
      matches: [
        played(1, 2, 1, 3, 0),
        played(2, 1, 2, 2, 1),
        played(1, 3, 3, 2, 1),
        { date: "2026-05-03", time: "18:00", court: "Blue Ct", teamNumbers: [2, 3], outcome: { status: "unplayed" } },
      ],
    });
    const { byTeam } = computeStandings(snap);
    expect(byTeam.get(1)).toMatchObject({ setsWon: 3 + 1 + 1, setsLost: 0 + 2 + 2 });
    expect(byTeam.get(2)).toMatchObject({ setsWon: 0 + 2, setsLost: 3 + 1 });
    expect(byTeam.get(3)).toMatchObject({ setsWon: 2, setsLost: 1 });
  });

  it("returns one group per division, alphabetically, each ranked independently", () => {
    const snap = makeSnapshot({
      teams: [team(1, "A", "BB"), team(2, "B", "BB"), team(3, "C", "B"), team(4, "D", "B")],
      matches: [played(1, 2, 2, 3, 0), played(3, 4, 3, 2, 1)],
    });
    const { divisions } = computeStandings(snap);
    expect(divisions.map((g) => [g.division, g.rows.map((r) => `${r.teamNumber}:${r.rankLabel}`)])).toEqual([
      ["B", ["3:1", "4:2"]],
      ["BB", ["2:1", "1:2"]],
    ]);
  });
});
