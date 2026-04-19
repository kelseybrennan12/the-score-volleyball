import { computeRecords } from "@/backend/logic/core/record";
import type { Match, Team } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

const teams: Team[] = [
  { number: 1, captain: "A", division: "B" },
  { number: 2, captain: "B", division: "B" },
  { number: 3, captain: "C", division: "BB" },
];

function played(teamNumbers: [number, number], winner: number, setsWinner: 3 | 2): Match {
  return {
    date: "2026-04-26",
    time: "18:00",
    court: "Blue",
    teamNumbers,
    outcome: { status: "played", winnerTeamNumber: winner, setsWinner, setsLoser: setsWinner === 3 ? 0 : 1 },
  };
}

describe("computeRecords", () => {
  it("sums sets across played matches, counting inter-division matches toward both records", () => {
    const matches: Match[] = [played([1, 2], 1, 3), played([2, 1], 2, 2), played([1, 3], 3, 2)];
    const records = computeRecords(teams, matches);
    expect(records.get(1)).toEqual({ teamNumber: 1, setsWon: 3 + 1 + 1, setsLost: 0 + 2 + 2 });
    expect(records.get(2)).toEqual({ teamNumber: 2, setsWon: 0 + 2, setsLost: 3 + 1 });
    expect(records.get(3)).toEqual({ teamNumber: 3, setsWon: 2, setsLost: 1 });
  });

  it("ignores unplayed matches", () => {
    const matches: Match[] = [
      {
        date: "2026-04-26",
        time: "18:00",
        court: "Blue",
        teamNumbers: [1, 2],
        outcome: { status: "unplayed" },
      },
    ];
    const records = computeRecords(teams, matches);
    expect(records.get(1)).toEqual({ teamNumber: 1, setsWon: 0, setsLost: 0 });
  });
});
