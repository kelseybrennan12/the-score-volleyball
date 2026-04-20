import { validateSnapshot } from "@/backend/logic/core/validate";
import type { Match, Team } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function team(number: number, division = "B"): Team {
  return { number, captain: `Captain ${number}`, division };
}

function unplayed(date: string, time: string, court: string, a: number, b: number): Match {
  return { date, time, court, teamNumbers: [a, b], outcome: { status: "unplayed" } };
}

function played(
  date: string,
  time: string,
  court: string,
  a: number,
  b: number,
  winner: number,
  score: [number, number] = [3, 0],
): Match {
  return {
    date,
    time,
    court,
    teamNumbers: [a, b],
    outcome: { status: "played", winnerTeamNumber: winner, setsWinner: score[0], setsLoser: score[1] },
  };
}

function uniformSeason(teams: Team[]): Match[] {
  const matches: Match[] = [];
  const dates = ["2026-04-26", "2026-05-03", "2026-05-10", "2026-05-17"];
  for (const date of dates) {
    for (let i = 0; i < teams.length; i += 2) {
      const a = teams[i].number;
      const b = teams[i + 1]?.number;
      if (b == null) continue;
      matches.push(unplayed(date, "18:00", `Ct ${i}`, a, b));
    }
  }
  return matches;
}

describe("validateSnapshot", () => {
  it("returns no anomalies for a clean snapshot", () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const matches = uniformSeason(teams);
    expect(validateSnapshot({ teams, matches })).toEqual([]);
  });

  it("flags two matches sharing a slot", () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const matches = [unplayed("2026-04-26", "18:00", "Blue", 1, 2), unplayed("2026-04-26", "18:00", "Blue", 3, 4)];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("2026-04-26 18:00 Blue has 2 matches"))).toBe(true);
  });

  it("flags a team scheduled at two courts at the same minute", () => {
    const teams = [team(1), team(2), team(3)];
    const matches = [unplayed("2026-04-26", "18:00", "Blue", 1, 2), unplayed("2026-04-26", "18:00", "Yellow", 1, 3)];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("Team 1 is scheduled in multiple simultaneous"))).toBe(true);
  });

  it("flags a self-match", () => {
    const teams = [team(7)];
    const matches = [unplayed("2026-04-26", "18:00", "Blue", 7, 7)];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("pairs team 7 against itself"))).toBe(true);
  });

  it("flags unknown team numbers in matches", () => {
    const teams = [team(1)];
    const matches = [unplayed("2026-04-26", "18:00", "Blue", 1, 99)];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("references unknown team 99"))).toBe(true);
  });

  it("flags played matches where the winner is not listed first", () => {
    const teams = [team(1), team(2)];
    const matches = [played("2026-04-26", "18:00", "Blue", 1, 2, 2)];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("has winner 2 but 1 is listed first"))).toBe(true);
  });

  it("flags nonsense set scores", () => {
    const teams = [team(1), team(2)];
    const matches = [played("2026-04-26", "18:00", "Blue", 1, 2, 1, [1, 0])];
    const anomalies = validateSnapshot({ teams, matches });
    expect(anomalies.some((a) => a.includes("nonsense set score"))).toBe(true);
  });

  it("flags teams whose match count deviates from the divisional mode by more than 1", () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const base = uniformSeason(teams);
    const outlierExtras: Match[] = [
      unplayed("2026-05-24", "18:00", "Green", 1, 2),
      unplayed("2026-05-31", "18:00", "Green", 1, 3),
      unplayed("2026-06-07", "18:00", "Green", 1, 4),
    ];
    const anomalies = validateSnapshot({ teams, matches: [...base, ...outlierExtras] });
    expect(anomalies.some((a) => a.includes("Team 1 has"))).toBe(true);
  });
});
