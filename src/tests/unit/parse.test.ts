import { parseLeagueWorkbook } from "@/backend/logic/core/parse";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixturesDir = path.join(process.cwd(), "src/tests/fixtures");

describe("parseLeagueWorkbook", () => {
  it("parses the Sunday fixture with divisions and a schedule grid", async () => {
    const buffer = await readFile(path.join(fixturesDir, "spring-sundays-2026.xlsx"));
    const result = await parseLeagueWorkbook({ buffer, year: 2026 });
    expect(result.teams.length).toBeGreaterThan(30);
    const divisions = new Set(result.teams.map((t) => t.division));
    expect(divisions.has("B")).toBe(true);
    expect(divisions.has("BB")).toBe(true);
    expect(divisions.has("BBB")).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    for (const m of result.matches) {
      expect(m.date).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(m.teamNumbers[0]).toBeTypeOf("number");
      expect(m.teamNumbers[1]).toBeTypeOf("number");
    }
    // Regression: the Sunday sheet has a leftover secondary "Match Time:" block
    // with Friday dates (May 1, 8, 15, ...) that must NOT bleed into the real
    // Sunday schedule. Team 32 on 2026-04-26 should only appear in its two
    // real evening slots (6:00pm and 6:50pm).
    const team32OnOpeningDay = result.matches.filter((m) => m.date === "2026-04-26" && m.teamNumbers.includes(32));
    expect(team32OnOpeningDay.map((m) => m.time).sort()).toEqual(["18:00", "18:50"]);
  });

  it("parses the Tuesday fixture with default division fallback", async () => {
    const buffer = await readFile(path.join(fixturesDir, "spring-tuesdays-2026.xlsx"));
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "A" });
    expect(result.teams.length).toBeGreaterThan(10);
    const divisions = new Set(result.teams.map((t) => t.division));
    expect(divisions.has("A")).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });
});
