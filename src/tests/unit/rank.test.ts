import { computeRanks } from "@/backend/logic/core/rank";
import { computeRecords } from "@/backend/logic/core/record";
import type { Match, Team } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

const teams: Team[] = [
  { number: 1, captain: "A", division: "B" },
  { number: 2, captain: "B", division: "B" },
  { number: 3, captain: "C", division: "B" },
  { number: 10, captain: "D", division: "BB" },
  { number: 11, captain: "E", division: "BB" },
];

function match(ns: [number, number], winner: number, sets: 3 | 2): Match {
  return {
    date: "2026-04-26",
    time: "18:00",
    court: "Blue",
    teamNumbers: ns,
    outcome: { status: "played", winnerTeamNumber: winner, setsWinner: sets, setsLoser: sets === 3 ? 0 : 1 },
  };
}

describe("computeRanks", () => {
  it("ranks per division by sets-won desc, sets-lost asc, team-number asc", () => {
    const matches = [match([1, 2], 2, 3), match([2, 3], 2, 3), match([3, 1], 3, 2)];
    const records = computeRecords(teams, matches);
    const ranks = computeRanks(teams, records);
    const b = ["B", 3] as const;
    expect(ranks.get(2)).toMatchObject({ division: b[0], rank: 1, divisionSize: b[1] });
    expect(ranks.get(3)).toMatchObject({ division: b[0], rank: 2 });
    expect(ranks.get(1)).toMatchObject({ division: b[0], rank: 3 });
    expect(ranks.get(10)).toMatchObject({ division: "BB", rank: null, divisionSize: 2 });
    expect(ranks.get(11)).toMatchObject({ division: "BB", rank: null, divisionSize: 2 });
  });

  it("breaks ties with team-number asc", () => {
    const matches = [match([1, 2], 1, 3), match([2, 3], 2, 3), match([3, 1], 3, 3)];
    const records = computeRecords(teams, matches);
    const ranks = computeRanks(teams, records);
    expect(ranks.get(1)!.rank).toBe(1);
    expect(ranks.get(2)!.rank).toBe(2);
    expect(ranks.get(3)!.rank).toBe(3);
  });

  it("marks teams with no sets played as unranked", () => {
    const records = computeRecords(teams, []);
    const ranks = computeRanks(teams, records);
    expect(ranks.get(1)).toMatchObject({ division: "B", rank: null, divisionSize: 3 });
    expect(ranks.get(2)).toMatchObject({ division: "B", rank: null, divisionSize: 3 });
    expect(ranks.get(3)).toMatchObject({ division: "B", rank: null, divisionSize: 3 });
    expect(ranks.get(10)).toMatchObject({ division: "BB", rank: null, divisionSize: 2 });
    expect(ranks.get(11)).toMatchObject({ division: "BB", rank: null, divisionSize: 2 });
  });

  it("ranks only teams that have played, leaving the rest unranked", () => {
    const matches = [match([1, 2], 1, 3)];
    const records = computeRecords(teams, matches);
    const ranks = computeRanks(teams, records);
    expect(ranks.get(1)).toMatchObject({ rank: 1, divisionSize: 3 });
    expect(ranks.get(2)).toMatchObject({ rank: 2, divisionSize: 3 });
    expect(ranks.get(3)).toMatchObject({ rank: null, divisionSize: 3 });
  });
});
