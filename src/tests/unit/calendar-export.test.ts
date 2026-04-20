import { buildTeamIcs, icsFilenameFor } from "@/shared/domain/calendar-export";
import type { Match, Snapshot, Team } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function mkSnapshot(matches: Match[]): Snapshot {
  return {
    schemaVersion: 1,
    league: {
      slug: "sunday-spring-2026",
      displayName: "Spring Sundays",
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "sheet-xyz",
    },
    ingestedAt: "2026-04-19T14:05:30Z",
    teams: [
      { number: 1, captain: "Alice", division: "BB" },
      { number: 2, captain: "Bob, Jr.", division: "BB" },
      { number: 3, captain: "Cat", division: "BB" },
    ],
    matches,
  };
}

const TEAM: Team = { number: 1, captain: "Alice", division: "BB" };
const NOW = new Date("2026-04-20T20:55:30Z");

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

const matches: Match[] = [
  {
    date: "2026-04-26",
    time: "18:00",
    court: "Blue Ct",
    teamNumbers: [1, 2],
    outcome: { status: "unplayed" },
  },
  {
    date: "2026-05-03",
    time: "19:30",
    court: "Yellow; Ct",
    teamNumbers: [1, 3],
    outcome: { status: "played", winnerTeamNumber: 1, setsWinner: 2, setsLoser: 1 },
  },
  {
    date: "2026-05-10",
    time: "18:00",
    court: "Green Ct",
    teamNumbers: [2, 3],
    outcome: { status: "unplayed" },
  },
];

describe("buildTeamIcs", () => {
  it("produces a well-formed VCALENDAR envelope with CRLF line endings", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("PRODID:-//The Score Volleyball//Schedule Viewer//EN");
    expect(ics).toContain("VERSION:2.0");
  });

  it("includes a VTIMEZONE block for America/Detroit with both DST rules", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/Detroit");
    expect(ics).toContain("BEGIN:DAYLIGHT");
    expect(ics).toContain("BEGIN:STANDARD");
    expect(ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU");
    expect(ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU");
    expect(ics).toContain("END:VTIMEZONE");
  });

  it("emits one VEVENT per match the team participates in", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    const count = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
    expect(count).toBe(2);
  });

  it("emits DTSTART/DTEND with TZID and a 50-minute default duration", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics).toContain("DTSTART;TZID=America/Detroit:20260426T180000");
    expect(ics).toContain("DTEND;TZID=America/Detroit:20260426T185000");
    expect(ics).toContain("DTSTART;TZID=America/Detroit:20260503T193000");
    expect(ics).toContain("DTEND;TZID=America/Detroit:20260503T202000");
  });

  it("derives DTSTAMP and SEQUENCE from the generation time so re-downloads look newer", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics).toContain("DTSTAMP:20260420T205530Z");
    expect(ics).toContain(`SEQUENCE:${Math.floor(NOW.getTime() / 1000)}`);
  });

  it("produces higher SEQUENCE values on later regeneration", () => {
    const snapshot = mkSnapshot(matches);
    const early = buildTeamIcs(snapshot, TEAM, new Date("2026-04-20T20:55:30Z"));
    const later = buildTeamIcs(snapshot, TEAM, new Date("2026-04-21T10:00:00Z"));
    const earlySeq = Number(early.match(/SEQUENCE:(\d+)/)?.[1]);
    const laterSeq = Number(later.match(/SEQUENCE:(\d+)/)?.[1]);
    expect(laterSeq).toBeGreaterThan(earlySeq);
  });

  it("sets SUMMARY to include opponent number, captain, and division", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics).toContain("SUMMARY:Volleyball vs #2 Bob\\, Jr. (BB)");
    expect(ics).toContain("SUMMARY:Volleyball vs #3 Cat (BB)");
  });

  it("escapes RFC 5545 special characters in LOCATION", () => {
    const ics = buildTeamIcs(mkSnapshot(matches), TEAM, NOW);
    expect(ics).toContain("LOCATION:Yellow\\; Ct");
  });

  it("includes Result line only for played matches", () => {
    const ics = unfold(buildTeamIcs(mkSnapshot(matches), TEAM, NOW));
    expect(ics).toContain("Result: W 2-1");
    const unplayedEvent = ics.split("BEGIN:VEVENT")[1];
    expect(unplayedEvent).not.toContain("Result:");
  });

  it("produces byte-identical output when called with the same inputs and now", () => {
    const snapshot = mkSnapshot(matches);
    expect(buildTeamIcs(snapshot, TEAM, NOW)).toBe(buildTeamIcs(snapshot, TEAM, NOW));
  });

  it("scopes UIDs to the exporting team so both teams' exports coexist", () => {
    const snapshot = mkSnapshot([matches[0]]);
    const icsTeam1 = buildTeamIcs(snapshot, TEAM, NOW);
    const icsTeam2 = buildTeamIcs(snapshot, { number: 2, captain: "Bob, Jr.", division: "BB" }, NOW);
    const uid1 = icsTeam1.match(/UID:([^\r\n]+)/)?.[1];
    const uid2 = icsTeam2.match(/UID:([^\r\n]+)/)?.[1];
    expect(uid1).toBeTruthy();
    expect(uid2).toBeTruthy();
    expect(uid1).not.toBe(uid2);
  });

  it("falls back to opponent number only when opponent is missing from teams", () => {
    const snapshot = mkSnapshot(matches);
    snapshot.teams = snapshot.teams.filter((t) => t.number !== 2);
    const ics = buildTeamIcs(snapshot, TEAM, NOW);
    expect(ics).toContain("SUMMARY:Volleyball vs #2");
    expect(ics).not.toContain("SUMMARY:Volleyball vs #2 Bob");
  });

  it("returns a structurally valid calendar when the team has no matches", () => {
    const snapshot = mkSnapshot([]);
    const ics = buildTeamIcs(snapshot, TEAM, NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("folds lines longer than 75 octets with CRLF + leading space", () => {
    const longCaptain = "X".repeat(200);
    const snapshot = mkSnapshot([matches[0]]);
    snapshot.teams = [
      { number: 1, captain: "Alice", division: "BB" },
      { number: 2, captain: longCaptain, division: "BB" },
    ];
    const ics = buildTeamIcs(snapshot, TEAM, NOW);
    expect(ics).toMatch(/\r\n /);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("icsFilenameFor", () => {
  it("names the file by league slug and team number", () => {
    expect(icsFilenameFor(mkSnapshot([]), TEAM)).toBe("sunday-spring-2026-team-1.ics");
  });
});
