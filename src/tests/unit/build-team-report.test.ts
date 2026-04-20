import { buildReport } from "@/backend/logic/services/build-team-report";
import type { Match, Snapshot } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function snapshot(slug: string, displayName: string, matches: Match[]): Snapshot {
  return {
    schemaVersion: 1,
    league: {
      slug,
      displayName,
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "x",
    },
    ingestedAt: "2026-04-19T14:05:30Z",
    teams: [
      { number: 1, captain: "Alice", division: "B" },
      { number: 2, captain: "Bob", division: "B" },
      { number: 3, captain: "Cat", division: "B" },
    ],
    matches,
  };
}

const baseMatches: Match[] = [
  {
    date: "2026-04-26",
    time: "18:00",
    court: "Blue Ct",
    teamNumbers: [1, 2],
    outcome: { status: "played", winnerTeamNumber: 1, setsWinner: 3, setsLoser: 0 },
  },
  {
    date: "2026-05-03",
    time: "19:30",
    court: "Yellow Ct",
    teamNumbers: [3, 1],
    outcome: { status: "played", winnerTeamNumber: 3, setsWinner: 2, setsLoser: 1 },
  },
  {
    date: "2026-05-10",
    time: "18:00",
    court: "Green Ct",
    teamNumbers: [1, 2],
    outcome: { status: "unplayed" },
  },
];

describe("buildReport", () => {
  it("formats a text report with played and unplayed matches", () => {
    const report = buildReport({
      snapshots: [snapshot("spring-sundays", "Spring Sundays", baseMatches)],
      teamNumber: 1,
      format: "text",
    });
    expect(report).toContain("Spring Sundays 2026 — B Division — #1 Alice");
    expect(report).toContain("Record: ");
    expect(report).toContain("2026-04-26 6:00pm Blue Ct");
    expect(report).toContain("vs #2 Bob (B) [W 3-0]");
    expect(report).toContain("vs #3 Cat (B) [L 1-2]");
    const unplayedLine = report.split("\n").find((l) => l.includes("2026-05-10"));
    expect(unplayedLine).toBeDefined();
    expect(unplayedLine).not.toMatch(/\[/);
  });

  it("formats a markdown report with a table", () => {
    const report = buildReport({
      snapshots: [snapshot("spring-sundays", "Spring Sundays", baseMatches)],
      teamNumber: 1,
      format: "md",
    });
    expect(report).toContain("## Spring Sundays 2026 — B Division — #1 Alice");
    expect(report).toContain("| Date | Time | Court | Opponent | Outcome |");
    expect(report).toContain("| 2026-04-26 | 6:00pm | Blue Ct | #2 Bob (B) | W 3-0 |");
  });

  it("filters by --league and --team", () => {
    const sundays = snapshot("spring-sundays", "Spring Sundays", baseMatches);
    const mondays = snapshot("spring-mondays", "Spring Mondays", []);
    const report = buildReport({
      snapshots: [sundays, mondays],
      leagueSlug: "spring-sundays",
      teamNumber: 2,
      format: "text",
    });
    const teamHeaders = report.split("\n").filter((l) => l.includes("Division —"));
    expect(teamHeaders).toHaveLength(1);
    expect(teamHeaders[0]).toContain("#2 Bob");
    expect(report).not.toContain("Spring Mondays");
  });

  it("includes every team when no filters are applied", () => {
    const report = buildReport({
      snapshots: [snapshot("spring-sundays", "Spring Sundays", baseMatches)],
      format: "text",
    });
    expect(report).toContain("#1 Alice");
    expect(report).toContain("#2 Bob");
    expect(report).toContain("#3 Cat");
  });

  it("returns a friendly message when nothing matches the filters", () => {
    const report = buildReport({
      snapshots: [snapshot("spring-sundays", "Spring Sundays", baseMatches)],
      leagueSlug: "does-not-exist",
      format: "text",
    });
    expect(report).toContain("No snapshots match");
  });

  it("renders a team with no scheduled matches without crashing", () => {
    const report = buildReport({
      snapshots: [snapshot("spring-sundays", "Spring Sundays", [])],
      teamNumber: 1,
      format: "text",
    });
    expect(report).toContain("(no scheduled matches)");
  });
});
