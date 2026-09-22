import type { Match, Snapshot, Team } from "@/shared/domain/snapshot";
import { buildTeamDetail } from "@/shared/domain/team-detail";
import { describe, expect, it } from "vitest";

const ALICE: Team = { number: 1, captain: "Alice", division: "BB" };
const BOB: Team = { number: 2, captain: "Bob", division: "BB" };
const CAT: Team = { number: 3, captain: "Cat", division: "BB" };

function mk(
  date: string,
  time: string,
  teamNumbers: [number, number],
  outcome: Match["outcome"] = { status: "unplayed" },
): Match {
  return { date, time, court: "Blue Ct", teamNumbers, outcome };
}

function snapshot(matches: Match[], teams: Team[] = [ALICE, BOB, CAT]): Snapshot {
  return {
    schemaVersion: 1,
    league: {
      slug: "spring-sundays",
      displayName: "Spring Sundays",
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "x",
    },
    ingestedAt: "2026-04-19T14:05:30Z",
    teams,
    matches,
  };
}

// 2026-05-03 13:00 in America/Detroit (a Sunday).
const NOW = new Date("2026-05-03T17:00:00Z");

describe("buildTeamDetail", () => {
  it("lists only the team's own matches, in chronological order", () => {
    const detail = buildTeamDetail(
      snapshot([
        mk("2026-05-10", "19:00", [3, 1]),
        mk("2026-05-10", "18:00", [2, 3]),
        mk("2026-04-26", "18:00", [1, 2]),
        mk("2026-05-10", "18:00", [1, 2]),
      ]),
      ALICE,
      NOW,
    );
    expect(detail.matches.map((m) => `${m.match.date} ${m.match.time} ${m.match.teamNumbers.join("v")}`)).toEqual([
      "2026-04-26 18:00 1v2",
      "2026-05-10 18:00 1v2",
      "2026-05-10 19:00 3v1",
    ]);
  });

  it("resolves each opponent and the opponent's record; a missing opponent keeps only its number", () => {
    const detail = buildTeamDetail(
      snapshot([
        mk("2026-04-26", "18:00", [1, 2], { status: "played", winnerTeamNumber: 2, setsWinner: 2, setsLoser: 1 }),
        mk("2026-05-10", "18:00", [9, 1]),
      ]),
      ALICE,
      NOW,
    );
    expect(detail.matches[0].opponentNumber).toBe(2);
    expect(detail.matches[0].opponent).toEqual(BOB);
    expect(detail.matches[0].opponentRecord).toMatchObject({ teamNumber: 2, setsWon: 2, setsLost: 1 });
    expect(detail.matches[1].opponentNumber).toBe(9);
    expect(detail.matches[1].opponent).toBeNull();
    expect(detail.matches[1].opponentRecord).toBeNull();
  });

  it("reports each outcome from the team's side: a win, a loss, and no outcome for an unplayed match", () => {
    const detail = buildTeamDetail(
      snapshot([
        mk("2026-04-26", "18:00", [1, 2], { status: "played", winnerTeamNumber: 1, setsWinner: 2, setsLoser: 1 }),
        mk("2026-05-03", "18:00", [3, 1], { status: "played", winnerTeamNumber: 3, setsWinner: 3, setsLoser: 0 }),
        mk("2026-05-10", "18:00", [1, 2]),
      ]),
      ALICE,
      NOW,
    );
    expect(detail.matches.map((m) => m.outcome)).toEqual([
      { won: true, setsFor: 2, setsAgainst: 1, label: "W 2-1" },
      { won: false, setsFor: 0, setsAgainst: 3, label: "L 0-3" },
      null,
    ]);
  });

  it("carries the team's own Record and Rank row, with the Standings tie label", () => {
    const matches = [
      mk("2026-04-26", "18:00", [1, 2], { status: "played", winnerTeamNumber: 1, setsWinner: 3, setsLoser: 0 }),
      mk("2026-04-26", "19:00", [3, 2], { status: "played", winnerTeamNumber: 3, setsWinner: 3, setsLoser: 0 }),
    ];
    expect(buildTeamDetail(snapshot(matches), ALICE, NOW).standingsRow).toMatchObject({
      teamNumber: 1,
      setsWon: 3,
      setsLost: 0,
      rankLabel: "T-1",
      divisionSize: 3,
    });
  });

  it("has no record row for a team that is not on the roster", () => {
    const stranger: Team = { number: 42, captain: "Zed", division: "BB" };
    expect(buildTeamDetail(snapshot([]), stranger, NOW).standingsRow).toBeNull();
  });

  it("flags every match on the next match day, so both games of a league night stay next", () => {
    const detail = buildTeamDetail(
      snapshot([
        mk("2026-04-26", "18:00", [1, 2]),
        mk("2026-05-10", "19:00", [3, 1]),
        mk("2026-05-10", "18:00", [1, 2]),
        mk("2026-05-17", "18:00", [1, 3]),
      ]),
      ALICE,
      NOW,
    );
    expect(detail.nextDate).toBe("2026-05-10");
    expect(detail.matches.map((m) => m.isNext)).toEqual([false, true, true, false]);
  });

  it("reads 'today' in the league timezone: late evening UTC is still the same league day", () => {
    // 2026-05-11 02:30Z is 2026-05-10 22:30 in Detroit, so the 10th is still today and its matches are still next.
    const detail = buildTeamDetail(
      snapshot([mk("2026-05-10", "18:00", [1, 2]), mk("2026-05-17", "18:00", [1, 3])]),
      ALICE,
      new Date("2026-05-11T02:30:00Z"),
    );
    expect(detail.nextDate).toBe("2026-05-10");
  });

  it("has no next match when every match is in the past", () => {
    expect(buildTeamDetail(snapshot([mk("2026-04-26", "18:00", [1, 2])]), ALICE, NOW)).toMatchObject({
      nextDate: null,
      matches: [{ isNext: false }],
    });
  });

  it("has no next match and no schedule for a team with no matches", () => {
    expect(buildTeamDetail(snapshot([]), ALICE, NOW)).toMatchObject({ nextDate: null, matches: [] });
  });
});
