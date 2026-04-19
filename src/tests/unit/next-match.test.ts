import { findNextMatch } from "@/shared/domain/next-match";
import type { Match } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function mk(date: string, time: string): Match {
  return {
    date,
    time,
    court: "Blue",
    teamNumbers: [1, 2],
    outcome: { status: "unplayed" },
  };
}

describe("findNextMatch", () => {
  const now = new Date("2026-05-03T17:00:00Z");

  it("returns the earliest match with a calendar date today or later", () => {
    const matches = [mk("2026-04-26", "18:00"), mk("2026-05-10", "18:00"), mk("2026-05-17", "18:00")];
    expect(findNextMatch(matches, now)?.date).toBe("2026-05-10");
  });

  it("includes today's matches even if start time has passed", () => {
    const matches = [mk("2026-05-03", "08:00"), mk("2026-05-10", "08:00")];
    expect(findNextMatch(matches, now)?.date).toBe("2026-05-03");
  });

  it("returns null when all matches are before today", () => {
    const matches = [mk("2026-04-26", "18:00"), mk("2026-05-02", "18:00")];
    expect(findNextMatch(matches, now)).toBeNull();
  });
});
