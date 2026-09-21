import type { LeagueDay, Match, Snapshot } from "@/shared/domain/snapshot";
import {
  pickDefaultLeagueSlug,
  planSelectDay,
  planSelectLeague,
  planSelectStandings,
  planSelectTeam,
  resolveStandingsSelection,
  resolveViewerSelection,
  validateUrlSelection,
  type RawParams,
  type StoredSelection,
} from "@/shared/domain/viewer-selection";
import { describe, expect, it } from "vitest";

function mkSnapshot(slug: string, day: LeagueDay, teamNumbers: number[], matchDates: string[] = []): Snapshot {
  const matches: Match[] = matchDates.map((date) => ({
    date,
    time: "18:00",
    court: "Blue",
    teamNumbers: [1, 2],
    outcome: { status: "unplayed" },
  }));
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day, session: "spring", year: 2026, sourceSheetId: "x" },
    ingestedAt: "2026-04-01T00:00:00Z",
    teams: teamNumbers.map((n) => ({ number: n, captain: `c${n}`, division: "B" })),
    matches,
  };
}

const snapshots: Snapshot[] = [
  mkSnapshot("spring-sundays", "sunday", [1, 2, 3]),
  mkSnapshot("spring-mondays", "monday", [10, 11]),
];

const EMPTY_PARAMS: RawParams = { view: null, day: null, league: null, team: null, standings: null, division: null };
const TODAY = "2026-04-15";

function resolve(params: Partial<RawParams>, stored: StoredSelection | null = null, snaps = snapshots) {
  return resolveViewerSelection({
    snapshots: snaps,
    params: { ...EMPTY_PARAMS, ...params },
    stored,
    todayIso: TODAY,
  });
}

describe("validateUrlSelection (migrated)", () => {
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

describe("resolveViewerSelection", () => {
  it("passes through a fully valid team-view URL", () => {
    const { selection } = resolve({ day: "sunday", league: "spring-sundays", team: 2 });
    expect(selection).toMatchObject({ view: "team", day: "sunday", league: "spring-sundays", team: 2 });
  });

  it("defaults view to team when the parameter is absent or invalid", () => {
    expect(resolve({}).selection.view).toBe("team");
    expect(resolve({ view: "bogus" }).selection.view).toBe("team");
    expect(resolve({ view: "now" }).selection.view).toBe("now");
    expect(resolve({ view: "standings" }).selection.view).toBe("standings");
  });

  describe("URL beats storage", () => {
    it("ignores storage when the URL names a day", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "spring-mondays", teamNumber: 10 };
      const { selection } = resolve({ day: "sunday" }, stored);
      expect(selection.day).toBe("sunday");
      // partial URL is taken as-is, storage is not merged in
      expect(selection.league).toBe("spring-sundays"); // default league for today, not the stored monday league
      expect(selection.team).toBeNull();
    });
  });

  describe("all-or-nothing storage fallback", () => {
    it("hydrates from storage only when the URL names none of day/league/team", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "spring-mondays", teamNumber: 10 };
      const { selection } = resolve({}, stored);
      expect(selection).toMatchObject({ day: "monday", league: "spring-mondays", team: 10 });
    });

    it("does not consult storage when the URL names any of day/league/team", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "spring-mondays", teamNumber: 10 };
      // a lone (orphan) team in the URL still counts as the URL naming a param → storage ignored
      const { selection } = resolve({ team: 2 }, stored);
      expect(selection.day).toBeNull();
      expect(selection.league).toBeNull();
      expect(selection.team).toBeNull();
    });

    it("drops stale stored values via the cascade", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "no-longer-ingested", teamNumber: 10 };
      const { selection } = resolve({}, stored);
      // stale league dropped, default league for monday filled in, team cascaded away
      expect(selection.day).toBe("monday");
      expect(selection.league).toBe("spring-mondays");
      expect(selection.team).toBeNull();
    });
  });

  describe("storage hydration writes", () => {
    it("produces a storageWrite reflecting the resolved selection", () => {
      const stored: StoredSelection = { day: "sunday", leagueSlug: "spring-sundays", teamNumber: 2 };
      const { storageWrite } = resolve({}, stored);
      expect(storageWrite).toEqual({ day: "sunday", leagueSlug: "spring-sundays", teamNumber: 2 });
    });
  });

  describe("cascade including orphans", () => {
    it("drops league on a different day and cascades team", () => {
      const { selection } = resolve({ day: "sunday", league: "spring-mondays", team: 10 });
      expect(selection).toMatchObject({ day: "sunday", league: "spring-sundays", team: null });
    });

    it("clears an orphan team with no league", () => {
      const { selection } = resolve({ day: "sunday", team: 2 });
      // day resolves, default league fills in, orphan team from a null-league URL is cleared
      expect(selection).toMatchObject({ day: "sunday", league: "spring-sundays", team: null });
    });
  });

  describe("default league by today", () => {
    it("fills in the league that is live today when a day has none", () => {
      const seasoned: Snapshot[] = [
        mkSnapshot("old-sundays", "sunday", [1], ["2026-01-04", "2026-02-01"]),
        mkSnapshot("current-sundays", "sunday", [7], ["2026-04-05", "2026-05-31"]),
      ];
      const { selection } = resolve({ day: "sunday" }, null, seasoned);
      expect(selection.league).toBe("current-sundays");
    });
  });

  describe("stale values dropped on a later render", () => {
    it("drops a league that disappears from the snapshot set", () => {
      // First render: valid.
      const first = resolve({ day: "monday", league: "spring-mondays", team: 10 });
      expect(first.selection.league).toBe("spring-mondays");
      // Later render with a snapshot set that no longer has monday.
      const later = resolveViewerSelection({
        snapshots: [snapshots[0]],
        params: { ...EMPTY_PARAMS, day: "monday", league: "spring-mondays", team: 10 },
        stored: null,
        todayIso: TODAY,
      });
      // `monday` is still a valid weekday, but its league (and the team under it) are now stale and dropped.
      expect(later.selection.day).toBe("monday");
      expect(later.selection.league).toBeNull();
      expect(later.selection.team).toBeNull();
    });
  });

  describe("standings selection (own parameters)", () => {
    it("resolves a valid standings/division pair", () => {
      const { selection } = resolve({ view: "standings", standings: "spring-mondays", division: "B" });
      expect(selection).toMatchObject({ standingsLeague: "spring-mondays", division: "B" });
    });

    it("is independent of day, league, and team", () => {
      const { selection } = resolve({
        view: "standings",
        day: "sunday",
        league: "spring-sundays",
        team: 2,
        standings: "spring-mondays",
        division: "B",
      });
      // Team-search selection is preserved untouched alongside the standings selection.
      expect(selection).toMatchObject({
        day: "sunday",
        league: "spring-sundays",
        team: 2,
        standingsLeague: "spring-mondays",
        division: "B",
      });
    });

    it("drops both when the standings league is not an active snapshot", () => {
      const { selection } = resolve({ view: "standings", standings: "no-such-league", division: "B" });
      expect(selection).toMatchObject({ standingsLeague: null, division: null });
    });

    it("drops both when the division is not present in that snapshot's teams", () => {
      const { selection } = resolve({ view: "standings", standings: "spring-mondays", division: "ZZ" });
      expect(selection).toMatchObject({ standingsLeague: null, division: null });
    });

    it("resolves the standings selection regardless of the day validated for Team search", () => {
      // `standings` names a monday snapshot while the Team search sits on sunday; neither disturbs the other.
      const { selection } = resolve({ view: "standings", day: "sunday", standings: "spring-mondays", division: "B" });
      expect(selection.day).toBe("sunday");
      expect(selection.standingsLeague).toBe("spring-mondays");
    });

    it("survives a view toggle: the same params resolve identically under view=now and view=team", () => {
      const params = { standings: "spring-mondays", division: "B" };
      expect(resolve({ ...params, view: "standings" }).selection).toMatchObject({
        standingsLeague: "spring-mondays",
        division: "B",
      });
      expect(resolve({ ...params, view: "now" }).selection).toMatchObject({
        standingsLeague: "spring-mondays",
        division: "B",
      });
      expect(resolve({ ...params, view: "team" }).selection).toMatchObject({
        standingsLeague: "spring-mondays",
        division: "B",
      });
    });
  });

  describe("transitional old-shape standings link", () => {
    it("reads a bare league+division in the standings view as the standings selection", () => {
      const { selection } = resolve({ view: "standings", league: "spring-mondays", division: "B" });
      expect(selection.standingsLeague).toBe("spring-mondays");
      expect(selection.division).toBe("B");
    });

    it("re-validates the old-link league as Team search (an orphan league is dropped)", () => {
      const { selection } = resolve({ view: "standings", league: "spring-mondays", division: "B" });
      // The same `league` value, seen as a Team-search parameter, is an orphan (no day) and is dropped.
      expect(selection.day).toBeNull();
      expect(selection.league).toBeNull();
      expect(selection.team).toBeNull();
    });

    it("does not fold a bare league into standings outside the standings view", () => {
      const { selection } = resolve({ view: "team", day: "monday", league: "spring-mondays", division: "B" });
      expect(selection.standingsLeague).toBeNull();
      expect(selection.division).toBeNull();
      // league remains the Team-search league.
      expect(selection.league).toBe("spring-mondays");
    });

    it("prefers the new `standings` parameter over the old-link fold", () => {
      const { selection } = resolve({
        view: "standings",
        standings: "spring-sundays",
        league: "spring-mondays",
        division: "B",
      });
      expect(selection.standingsLeague).toBe("spring-sundays");
    });
  });
});

describe("resolveStandingsSelection", () => {
  it("validates the new `standings` parameter against the active snapshots", () => {
    expect(
      resolveStandingsSelection(snapshots, "standings", { standings: "spring-sundays", league: null, division: "B" }),
    ).toEqual({
      standingsLeague: "spring-sundays",
      division: "B",
    });
  });

  it("returns nothing selected when no standings league is named", () => {
    expect(resolveStandingsSelection(snapshots, "standings", { standings: null, league: null, division: "B" })).toEqual(
      {
        standingsLeague: null,
        division: null,
      },
    );
  });

  it("ignores a bare league outside the standings view", () => {
    expect(
      resolveStandingsSelection(snapshots, "team", { standings: null, league: "spring-mondays", division: "B" }),
    ).toEqual({
      standingsLeague: null,
      division: null,
    });
  });
});

describe("action planners", () => {
  it("planSelectDay sets the live league for today and clears the team", () => {
    expect(planSelectDay(snapshots, TODAY, "sunday")).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: null,
    });
  });

  it("planSelectDay yields a null league when the day has no snapshot", () => {
    expect(planSelectDay(snapshots, TODAY, "friday")).toEqual({ day: "friday", league: null, team: null });
  });

  it("planSelectLeague sets the league and clears the team", () => {
    expect(planSelectLeague("spring-sundays")).toEqual({ league: "spring-sundays", team: null });
  });

  it("planSelectTeam sets the team", () => {
    expect(planSelectTeam(2)).toEqual({ team: 2 });
    expect(planSelectTeam(null)).toEqual({ team: null });
  });

  it("planSelectStandings writes the standings league and division only", () => {
    expect(planSelectStandings("spring-mondays", "B")).toEqual({ standings: "spring-mondays", division: "B" });
  });
});

describe("pickDefaultLeagueSlug", () => {
  it("returns null when no snapshot exists for the day", () => {
    expect(pickDefaultLeagueSlug(snapshots, "friday", TODAY)).toBeNull();
  });

  it("returns the sole snapshot's slug for a day with one league", () => {
    expect(pickDefaultLeagueSlug(snapshots, "sunday", TODAY)).toBe("spring-sundays");
  });
});
