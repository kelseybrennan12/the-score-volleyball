import { currentHHmmInLeagueTimezone, dayOfWeekInLeagueTimezone, selectNowMatches } from "@/shared/domain/now-view";
import type { LeagueDay, Match, Snapshot } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function mkMatch(date: string, time: string, court = "Blue Ct", teamNumbers: [number, number] = [1, 2]): Match {
  return { date, time, court, teamNumbers, outcome: { status: "unplayed" } };
}

function mkSnapshot(slug: string, day: LeagueDay, matches: Match[]): Snapshot {
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day, session: "spring", year: 2026, sourceSheetId: "x" },
    ingestedAt: "2026-04-01T00:00:00Z",
    teams: [
      { number: 1, captain: "A", division: "B" },
      { number: 2, captain: "B", division: "B" },
    ],
    matches,
  };
}

// 2026-04-26 is a Sunday. 11:20 local time in America/Detroit ≈ 15:20 UTC during DST.
const SUNDAY_AT_1120 = new Date("2026-04-26T15:20:00Z");
const SUNDAY_AT_1121 = new Date("2026-04-26T15:21:00Z");
const SUNDAY_AT_0900 = new Date("2026-04-26T13:00:00Z");
const MONDAY_AT_1120 = new Date("2026-04-27T15:20:00Z");

describe("dayOfWeekInLeagueTimezone", () => {
  it("returns lowercase weekday names matching LeagueDay", () => {
    expect(dayOfWeekInLeagueTimezone(SUNDAY_AT_1120)).toBe("sunday");
    expect(dayOfWeekInLeagueTimezone(MONDAY_AT_1120)).toBe("monday");
  });

  it("returns null for Saturday (not a league day)", () => {
    const saturday = new Date("2026-04-25T15:20:00Z");
    expect(dayOfWeekInLeagueTimezone(saturday)).toBeNull();
  });
});

describe("currentHHmmInLeagueTimezone", () => {
  it("returns HH:mm in America/Detroit", () => {
    expect(currentHHmmInLeagueTimezone(SUNDAY_AT_1120)).toBe("11:20");
    expect(currentHHmmInLeagueTimezone(SUNDAY_AT_0900)).toBe("09:00");
  });
});

describe("selectNowMatches", () => {
  it("returns matches whose time exactly equals current HH:mm on today's date", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "11:20", "Blue Ct"),
      mkMatch("2026-04-26", "12:00", "Blue Ct"),
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(1);
    expect(result.groupsByCourt.get("Blue Ct")?.length).toBe(1);
    expect(result.groupsByCourt.get("Blue Ct")?.[0]?.match.time).toBe("11:20");
    expect(result.anyLeagueToday).toBe(true);
    expect(result.nextUpcomingTime).toBe("12:00");
    expect(result.upcomingByCourt.get("Blue Ct")?.[0]?.match.time).toBe("12:00");
  });

  it("filters out matches from snapshots whose league.day is not today", () => {
    const monday = mkSnapshot("spring-mondays", "monday", [mkMatch("2026-04-26", "11:20", "Blue Ct")]);
    const result = selectNowMatches([monday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(0);
    expect(result.anyLeagueToday).toBe(false);
  });

  it("filters out matches whose date is not today even if time matches", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [mkMatch("2026-05-03", "11:20", "Blue Ct")]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(0);
    expect(result.nextUpcomingTime).toBeNull();
    expect(result.anyLeagueToday).toBe(true);
  });

  it("includes matches that started up to (windowMinutes - 1) ago under default 50-minute window", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "10:31", "Blue Ct"), // 49 min before 11:20 → included
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(1);
  });

  it("excludes matches that started exactly windowMinutes ago (next-game boundary)", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "10:30", "Blue Ct"), // 50 min before 11:20 → excluded (next game has started)
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(0);
  });

  it("excludes matches whose start time is in the future", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "11:21", "Blue Ct"), // 1 min in the future
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(0);
    expect(result.nextUpcomingTime).toBe("11:21");
  });

  it("respects a narrower windowMinutes override", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "11:00", "Blue Ct"), // 20 min before 11:20
      mkMatch("2026-04-26", "10:45", "Yellow Ct"), // 35 min before 11:20
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120, 25);
    const courts = [...result.groupsByCourt.keys()].sort();
    expect(courts).toEqual(["Blue Ct"]);
  });

  it("surfaces the next upcoming time today when nothing is currently playing", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "12:00", "Blue Ct"),
      mkMatch("2026-04-26", "13:00", "Yellow Ct"),
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.nextUpcomingTime).toBe("12:00");
  });

  it("surfaces nextUpcomingTime even when matches are currently playing", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "11:20", "Blue Ct"),
      mkMatch("2026-04-26", "12:00", "Yellow Ct"),
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.nextUpcomingTime).toBe("12:00");
    expect(result.upcomingByCourt.size).toBe(1);
    expect(result.upcomingByCourt.get("Yellow Ct")?.[0]?.match.time).toBe("12:00");
  });

  it("groups multiple upcoming matches at the same next-time across courts", () => {
    const sunday = mkSnapshot("spring-sundays", "sunday", [
      mkMatch("2026-04-26", "11:20", "Blue Ct"),
      mkMatch("2026-04-26", "12:00", "Blue Ct", [3, 4]),
      mkMatch("2026-04-26", "12:00", "Yellow Ct", [5, 6]),
      mkMatch("2026-04-26", "13:00", "Blue Ct", [7, 8]),
    ]);
    const result = selectNowMatches([sunday], SUNDAY_AT_1120);
    expect(result.nextUpcomingTime).toBe("12:00");
    expect([...result.upcomingByCourt.keys()].sort()).toEqual(["Blue Ct", "Yellow Ct"]);
    expect(result.upcomingByCourt.get("Blue Ct")?.length).toBe(1);
    expect(result.upcomingByCourt.get("Blue Ct")?.[0]?.match.teamNumbers).toEqual([3, 4]);
  });

  it("returns anyLeagueToday=false when no snapshot has matching league.day", () => {
    const monday = mkSnapshot("spring-mondays", "monday", [mkMatch("2026-04-27", "11:20", "Blue Ct")]);
    const result = selectNowMatches([monday], SUNDAY_AT_1120);
    expect(result.anyLeagueToday).toBe(false);
    expect(result.groupsByCourt.size).toBe(0);
  });

  it("aggregates matches across multiple Sunday snapshots", () => {
    const a = mkSnapshot("spring-sundays", "sunday", [mkMatch("2026-04-26", "11:20", "Blue Ct", [1, 2])]);
    const b = mkSnapshot("fall-sundays", "sunday", [mkMatch("2026-04-26", "11:20", "Yellow Ct", [3, 4])]);
    const result = selectNowMatches([a, b], SUNDAY_AT_1120);
    expect(result.groupsByCourt.size).toBe(2);
  });
});
