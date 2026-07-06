import { buildSeasonArchives, seasonKeyFor, seasonLabel } from "@/shared/domain/seasons";
import type { Snapshot } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

function snap(slug: string, session: Snapshot["league"]["session"], year: number): Snapshot {
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day: "sunday", session, year, sourceSheetId: "x" },
    ingestedAt: "2026-01-01T00:00:00Z",
    teams: [],
    matches: [],
  };
}

describe("seasons domain", () => {
  it("formats season keys and labels", () => {
    expect(seasonKeyFor("spring", 2026)).toBe("spring-2026");
    expect(seasonLabel("spring", 2026)).toBe("Spring 2026");
    expect(seasonLabel("summer", 2025)).toBe("Summer 2025");
  });

  it("builds archives and derives identity from each group's snapshots", () => {
    const byKey = new Map<string, Snapshot[]>([
      ["spring-2026", [snap("spring-sundays", "spring", 2026), snap("spring-mondays", "spring", 2026)]],
    ]);
    const archives = buildSeasonArchives(byKey);
    expect(archives).toHaveLength(1);
    expect(archives[0]).toMatchObject({ key: "spring-2026", session: "spring", year: 2026, label: "Spring 2026" });
    expect(archives[0].snapshots).toHaveLength(2);
  });

  it("sorts archives newest-first by year then session", () => {
    const byKey = new Map<string, Snapshot[]>([
      ["spring-2026", [snap("spring-sundays", "spring", 2026)]],
      ["fall-2025", [snap("fall-sundays", "fall", 2025)]],
      ["summer-2026", [snap("summer-sundays", "summer", 2026)]],
      ["spring-2025", [snap("spring-sundays", "spring", 2025)]],
    ]);
    expect(buildSeasonArchives(byKey).map((a) => a.key)).toEqual([
      "summer-2026",
      "spring-2026",
      "fall-2025",
      "spring-2025",
    ]);
  });

  it("skips empty groups", () => {
    const byKey = new Map<string, Snapshot[]>([["spring-2026", []]]);
    expect(buildSeasonArchives(byKey)).toEqual([]);
  });
});
