import type { LeagueDay, Match, Snapshot } from "@/shared/domain/snapshot";
import {
  pickDefaultLeagueSlug,
  planSelectDay,
  resolveStandingsSelection,
  resolveViewerSelection,
  toStorageWrite,
  validateSelection,
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
const STORED_MONDAY: StoredSelection = { day: "monday", leagueSlug: "spring-mondays", teamNumber: 10 };

function resolve(params: Partial<RawParams>, stored: StoredSelection | null = null, snaps = snapshots) {
  return resolveViewerSelection({
    snapshots: snaps,
    params: { ...EMPTY_PARAMS, ...params },
    stored,
    todayIso: TODAY,
  });
}

describe("validateSelection (day → league → team cascade)", () => {
  it("passes through fully valid input", () => {
    expect(validateSelection(snapshots, { day: "sunday", league: "spring-sundays", team: 2 })).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: 2,
    });
  });

  it("drops invalid day and cascades", () => {
    expect(validateSelection(snapshots, { day: "funday", league: "spring-sundays", team: 2 })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("drops uppercase / typo'd day", () => {
    expect(validateSelection(snapshots, { day: "SUNDAY", league: null, team: null })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("drops league not present for the resolved day, cascading team", () => {
    expect(validateSelection(snapshots, { day: "sunday", league: "does-not-exist", team: 2 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops team that does not exist on the resolved snapshot", () => {
    expect(validateSelection(snapshots, { day: "sunday", league: "spring-sundays", team: 99 })).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: null,
    });
  });

  it("drops league that belongs to a different day", () => {
    expect(validateSelection(snapshots, { day: "sunday", league: "spring-mondays", team: 10 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops orphan team without league", () => {
    expect(validateSelection(snapshots, { day: "sunday", league: null, team: 2 })).toEqual({
      day: "sunday",
      league: null,
      team: null,
    });
  });

  it("drops orphan league without day", () => {
    expect(validateSelection(snapshots, { day: null, league: "spring-sundays", team: 2 })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });

  it("returns all-null when input is all-null", () => {
    expect(validateSelection(snapshots, { day: null, league: null, team: null })).toEqual({
      day: null,
      league: null,
      team: null,
    });
  });
});

describe("resolveViewerSelection", () => {
  it("passes through a fully valid team-view URL with no writes", () => {
    const { selection, urlWrites, storageWrite } = resolve({ day: "sunday", league: "spring-sundays", team: 2 });
    expect(selection).toMatchObject({ view: "team", day: "sunday", league: "spring-sundays", team: 2 });
    expect(urlWrites).toEqual({});
    expect(storageWrite).toEqual({ day: "sunday", leagueSlug: "spring-sundays", teamNumber: 2 });
  });

  it("defaults view to team when the parameter is absent or invalid, without rewriting it", () => {
    expect(resolve({}).selection.view).toBe("team");
    expect(resolve({ view: "bogus" }).selection.view).toBe("team");
    expect(resolve({ view: "bogus" }).urlWrites).toEqual({});
    expect(resolve({ view: "now" }).selection.view).toBe("now");
    expect(resolve({ view: "standings" }).selection.view).toBe("standings");
  });

  describe("URL beats storage", () => {
    it("ignores storage when the URL names a day", () => {
      const { selection } = resolve({ day: "sunday" }, STORED_MONDAY);
      expect(selection.day).toBe("sunday");
      // partial URL is taken as-is, storage is not merged in
      expect(selection.league).toBe("spring-sundays"); // default league for today, not the stored monday league
      expect(selection.team).toBeNull();
    });
  });

  describe("all-or-nothing storage fallback", () => {
    it("hydrates from storage only when the URL names none of day/league/team", () => {
      const { selection } = resolve({}, STORED_MONDAY);
      expect(selection).toMatchObject({ day: "monday", league: "spring-mondays", team: 10 });
    });

    it("does not consult storage when the URL names any of day/league/team", () => {
      // a lone (orphan) team in the URL still counts as the URL naming a param → storage ignored
      const { selection, storageWrite } = resolve({ team: 2 }, STORED_MONDAY);
      expect(selection).toMatchObject({ day: null, league: null, team: null });
      // nothing worth remembering, and never a request to clear what is remembered
      expect(storageWrite).toBeNull();
    });

    it("drops stale stored values via the cascade", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "no-longer-ingested", teamNumber: 10 };
      const { selection } = resolve({}, stored);
      // stale league dropped, default league for monday filled in, team cascaded away
      expect(selection).toMatchObject({ day: "monday", league: "spring-mondays", team: null });
    });
  });

  describe("storage hydration writes", () => {
    it("pushes the remembered selection into the URL and re-remembers it", () => {
      const { urlWrites, storageWrite } = resolve({}, STORED_MONDAY);
      expect(urlWrites).toEqual({ day: "monday", league: "spring-mondays", team: 10 });
      expect(storageWrite).toEqual(STORED_MONDAY);
    });

    it("pushes only the surviving values when part of the remembered selection is stale", () => {
      const stored: StoredSelection = { day: "monday", leagueSlug: "no-longer-ingested", teamNumber: 10 };
      const { urlWrites, storageWrite } = resolve({}, stored);
      expect(urlWrites).toEqual({ day: "monday", league: "spring-mondays" });
      expect(storageWrite).toEqual({ day: "monday", leagueSlug: "spring-mondays" });
    });
  });

  describe("cascade including orphans", () => {
    it("drops league on a different day, cascades team, and rewrites the URL", () => {
      const { selection, urlWrites } = resolve({ day: "sunday", league: "spring-mondays", team: 10 });
      expect(selection).toMatchObject({ day: "sunday", league: "spring-sundays", team: null });
      expect(urlWrites).toEqual({ league: "spring-sundays", team: null });
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
      const { selection, urlWrites } = resolve({ day: "sunday" }, null, seasoned);
      expect(selection.league).toBe("current-sundays");
      expect(urlWrites).toEqual({ league: "current-sundays" });
    });
  });

  describe("stale values dropped on a later render", () => {
    it("drops a league that disappears from the snapshot set", () => {
      // First render: valid.
      const first = resolve({ day: "monday", league: "spring-mondays", team: 10 });
      expect(first.selection.league).toBe("spring-mondays");
      // Later render with a snapshot set that no longer has monday.
      const later = resolve({ day: "monday", league: "spring-mondays", team: 10 }, null, [snapshots[0]]);
      // `monday` is still a valid weekday, but its league (and the team under it) are now stale and dropped.
      expect(later.selection).toMatchObject({ day: "monday", league: null, team: null });
      expect(later.urlWrites).toEqual({ league: null, team: null });
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
      const { selection, urlWrites } = resolve({ view: "standings", standings: "no-such-league", division: "B" });
      expect(selection).toMatchObject({ standingsLeague: null, division: null });
      expect(urlWrites).toEqual({ standings: null, division: null });
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

    it("survives a view toggle: the same params resolve identically under every view", () => {
      const params = { standings: "spring-mondays", division: "B" };
      for (const view of ["standings", "now", "team"]) {
        expect(resolve({ ...params, view }).selection).toMatchObject({
          standingsLeague: "spring-mondays",
          division: "B",
        });
      }
    });
  });

  describe("transitional old-shape standings link", () => {
    const OLD_LINK = { view: "standings", league: "spring-mondays", division: "B" };

    it("reads a bare league+division in the standings view as the standings selection", () => {
      const { selection } = resolve(OLD_LINK);
      expect(selection.standingsLeague).toBe("spring-mondays");
      expect(selection.division).toBe("B");
    });

    it("rewrites the URL to the new shape: `league` moves into `standings`", () => {
      const { urlWrites } = resolve(OLD_LINK);
      expect(urlWrites).toEqual({ league: null, standings: "spring-mondays" });
    });

    it("treats the folded league as consumed, so Team search resolves from nothing", () => {
      const { selection, storageWrite } = resolve(OLD_LINK);
      expect(selection).toMatchObject({ day: null, league: null, team: null });
      expect(storageWrite).toBeNull();
    });

    it("keeps the remembered team: the folded league does not count as the URL naming a league", () => {
      const { selection, urlWrites, storageWrite } = resolve(OLD_LINK, STORED_MONDAY);
      expect(selection).toMatchObject({
        day: "monday",
        league: "spring-mondays",
        team: 10,
        standingsLeague: "spring-mondays",
        division: "B",
      });
      // The old `league` value is rewritten as the Team-search league that storage hydrated, and the standings
      // parameter is added; the remembered selection is re-remembered rather than cleared.
      expect(urlWrites).toEqual({ day: "monday", team: 10, standings: "spring-mondays" });
      expect(storageWrite).toEqual(STORED_MONDAY);
    });

    it("does not fold when the old pair is invalid, so `league` stays a Team-search parameter", () => {
      const { selection, storageWrite } = resolve(
        { view: "standings", league: "spring-mondays", division: "ZZ" },
        STORED_MONDAY,
      );
      // Not folded: the URL names an (orphan) league, storage is not consulted, and nothing is remembered or cleared.
      expect(selection).toMatchObject({ day: null, league: null, team: null, standingsLeague: null, division: null });
      expect(storageWrite).toBeNull();
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
    ).toEqual({ standingsLeague: "spring-sundays", division: "B", foldedLeague: false });
  });

  it("returns nothing selected when no standings league is named", () => {
    expect(resolveStandingsSelection(snapshots, "standings", { standings: null, league: null, division: "B" })).toEqual(
      { standingsLeague: null, division: null, foldedLeague: false },
    );
  });

  it("reports when a bare league was folded in", () => {
    expect(
      resolveStandingsSelection(snapshots, "standings", { standings: null, league: "spring-mondays", division: "B" }),
    ).toEqual({ standingsLeague: "spring-mondays", division: "B", foldedLeague: true });
  });

  it("ignores a bare league outside the standings view", () => {
    expect(
      resolveStandingsSelection(snapshots, "team", { standings: null, league: "spring-mondays", division: "B" }),
    ).toEqual({ standingsLeague: null, division: null, foldedLeague: false });
  });
});

describe("planSelectDay", () => {
  it("sets the live league for today and clears the team", () => {
    expect(planSelectDay(snapshots, TODAY, "sunday")).toEqual({
      day: "sunday",
      league: "spring-sundays",
      team: null,
    });
  });

  it("yields a null league when the day has no snapshot", () => {
    expect(planSelectDay(snapshots, TODAY, "friday")).toEqual({ day: "friday", league: null, team: null });
  });
});

describe("toStorageWrite", () => {
  it("keeps only the present values and uses the stored field names", () => {
    expect(toStorageWrite({ day: "sunday", league: "spring-sundays", team: 2 })).toEqual({
      day: "sunday",
      leagueSlug: "spring-sundays",
      teamNumber: 2,
    });
    expect(toStorageWrite({ day: "sunday", league: null, team: null })).toEqual({ day: "sunday" });
  });

  it("returns null when there is nothing to remember", () => {
    expect(toStorageWrite({ day: null, league: null, team: null })).toBeNull();
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
