import type { LeagueDay, Snapshot } from "@/shared/domain/snapshot";
import { validateUrlSelection } from "@/shared/domain/url-selection";
import { describe, expect, it } from "vitest";

function mkSnapshot(slug: string, day: LeagueDay, teamNumbers: number[]): Snapshot {
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day, session: "spring", year: 2026, sourceSheetId: "x" },
    ingestedAt: "2026-04-01T00:00:00Z",
    teams: teamNumbers.map((n) => ({ number: n, captain: `c${n}`, division: "B" })),
    matches: [],
  };
}

const snapshots: Snapshot[] = [
  mkSnapshot("spring-sundays", "sunday", [1, 2, 3]),
  mkSnapshot("spring-mondays", "monday", [10, 11]),
];

describe("validateUrlSelection", () => {
  it("passes through fully valid input", () => {
    expect(validateUrlSelection(snapshots, { day: "sunday", league: "spring-sundays", team: 2 })).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: 2,
    });
  });

  it("drops invalid day and cascades", () => {
    expect(validateUrlSelection(snapshots, { day: "funday", league: "spring-sundays", team: 2 })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("drops uppercase / typo'd day", () => {
    expect(validateUrlSelection(snapshots, { day: "SUNDAY", league: null, team: null })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("drops league not present for the resolved day, cascading team", () => {
    expect(validateUrlSelection(snapshots, { day: "sunday", league: "does-not-exist", team: 2 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops team that does not exist on the resolved snapshot", () => {
    expect(validateUrlSelection(snapshots, { day: "sunday", league: "spring-sundays", team: 99 })).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: null,
    });
  });

  it("drops league that belongs to a different day", () => {
    expect(validateUrlSelection(snapshots, { day: "sunday", league: "spring-mondays", team: 10 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops orphan team without league", () => {
    expect(validateUrlSelection(snapshots, { day: "sunday", league: null, team: 2 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops orphan league without day", () => {
    expect(validateUrlSelection(snapshots, { day: null, league: "spring-sundays", team: 2 })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("returns all-null when input is all-null", () => {
    expect(validateUrlSelection(snapshots, { day: null, league: null, team: null })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });
});
