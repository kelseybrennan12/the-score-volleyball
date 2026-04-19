import { pickCurrentSnapshot } from "@/shared/domain/current-season";
import type { Match, Snapshot } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function mkSnapshot(slug: string, matchDates: string[]): Snapshot {
  const matches: Match[] = matchDates.map((date) => ({
    date,
    time: "18:00",
    court: "Blue",
    teamNumbers: [1, 2],
    outcome: { status: "unplayed" },
  }));
  return {
    schemaVersion: 1,
    league: {
      slug,
      displayName: slug,
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "x",
    },
    ingestedAt: "2026-04-19T00:00:00Z",
    teams: [],
    matches,
  };
}

const spring = mkSnapshot("spring", ["2026-04-26", "2026-05-03", "2026-06-21"]);
const summer = mkSnapshot("summer", ["2026-07-05", "2026-08-16"]);
const fall = mkSnapshot("fall", ["2026-09-13", "2026-11-01"]);
const fallEmpty = mkSnapshot("fall-empty", []);

describe("pickCurrentSnapshot", () => {
  it("picks the session whose date range contains today", () => {
    expect(pickCurrentSnapshot([spring, summer, fall], "2026-05-10")?.league.slug).toBe("spring");
    expect(pickCurrentSnapshot([spring, summer, fall], "2026-07-20")?.league.slug).toBe("summer");
  });

  it("picks the next upcoming session when today is between seasons", () => {
    expect(pickCurrentSnapshot([spring, summer, fall], "2026-06-30")?.league.slug).toBe("summer");
    expect(pickCurrentSnapshot([spring, summer, fall], "2026-04-01")?.league.slug).toBe("spring");
  });

  it("picks the most recently ended session when all are past", () => {
    expect(pickCurrentSnapshot([spring, summer, fall], "2027-02-01")?.league.slug).toBe("fall");
  });

  it("ignores snapshots with no matches when picking by date", () => {
    expect(pickCurrentSnapshot([fallEmpty, spring], "2026-05-10")?.league.slug).toBe("spring");
  });
});
