import { parseLeagueWorkbook } from "@/backend/logic/core/parse";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixturesDir = path.join(process.cwd(), "src/tests/fixtures");

interface StubTeam {
  number: number;
  captain: string;
  rowLabel?: string;
}

interface StubWorkbookOptions {
  teams: StubTeam[];
  legendRows?: string[];
}

async function buildStubWorkbook(opts: StubWorkbookOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  opts.teams.forEach((t, idx) => {
    const row = ws.getRow(idx + 1);
    row.getCell(1).value = `${t.number}. ${t.captain}`;
    if (t.rowLabel) row.getCell(4).value = t.rowLabel;
  });
  (opts.legendRows ?? []).forEach((text, idx) => {
    ws.getRow(idx + 1).getCell(8).value = text;
  });
  const headerRowIndex = Math.max(opts.teams.length, opts.legendRows?.length ?? 0) + 2;
  const header = ws.getRow(headerRowIndex);
  header.getCell(1).value = "Match Time:";
  header.getCell(2).value = "May 3rd";
  const matchRow = ws.getRow(headerRowIndex + 1);
  matchRow.getCell(1).value = "6:00pm Blue Ct";
  matchRow.getCell(2).value = `${opts.teams[0].number} v ${opts.teams[1].number}`;
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

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

  it("derives divisions from a range legend block (Teams N-M \\ X League)", async () => {
    const buffer = await buildStubWorkbook({
      teams: [
        { number: 1, captain: "Alice" },
        { number: 2, captain: "Bob" },
        { number: 5, captain: "Cat" },
        { number: 8, captain: "Dan" },
        { number: 10, captain: "Eve" },
      ],
      legendRows: [
        "Sunday Coed 4's B & BB League",
        "Teams 1-4 \\ B League",
        "Teams 5-7 \\ BB League",
        "Teams 8-10 \\ BBB League",
      ],
    });
    const result = await parseLeagueWorkbook({ buffer, year: 2026 });
    const byNumber = new Map(result.teams.map((t) => [t.number, t.division]));
    expect(byNumber.get(1)).toBe("B");
    expect(byNumber.get(2)).toBe("B");
    expect(byNumber.get(5)).toBe("BB");
    expect(byNumber.get(8)).toBe("BBB");
    expect(byNumber.get(10)).toBe("BBB");
    expect(result.anomalies).toEqual([]);
  });

  it("falls back to per-row division label when no legend is present", async () => {
    const buffer = await buildStubWorkbook({
      teams: [
        { number: 1, captain: "Alice", rowLabel: "BB Division" },
        { number: 2, captain: "Bob", rowLabel: "BB Division" },
      ],
    });
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "A" });
    expect(result.teams.map((t) => t.division)).toEqual(["BB", "BB"]);
  });

  it("prefers the range legend over a per-row label when both are present", async () => {
    const buffer = await buildStubWorkbook({
      teams: [
        { number: 1, captain: "Alice", rowLabel: "A Division" },
        { number: 2, captain: "Bob", rowLabel: "A Division" },
      ],
      legendRows: ["Teams 1-2 \\ BB League"],
    });
    const result = await parseLeagueWorkbook({ buffer, year: 2026 });
    expect(result.teams.map((t) => t.division)).toEqual(["BB", "BB"]);
  });

  it("falls back to defaultDivision and records an anomaly for teams outside every range", async () => {
    const buffer = await buildStubWorkbook({
      teams: [
        { number: 1, captain: "Alice" },
        { number: 99, captain: "Outlier" },
      ],
      legendRows: ["Teams 1-10 \\ B League"],
    });
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "A" });
    const byNumber = new Map(result.teams.map((t) => [t.number, t.division]));
    expect(byNumber.get(1)).toBe("B");
    expect(byNumber.get(99)).toBe("A");
    expect(result.anomalies.some((a) => a.includes("Team 99"))).toBe(true);
  });

  it("parses a Date-valued schedule header cell (regression: opening Sunday 2026-04-26)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.getRow(1).getCell(1).value = "1. Alice";
    ws.getRow(2).getCell(1).value = "2. Bob";
    const header = ws.getRow(4);
    header.getCell(1).value = "Match Time:";
    header.getCell(2).value = new Date(Date.UTC(2026, 3, 26));
    header.getCell(3).value = "May 3rd";
    const matchRow = ws.getRow(5);
    matchRow.getCell(1).value = "6:00pm Blue Ct";
    matchRow.getCell(2).value = "1 v 2";
    matchRow.getCell(3).value = "2 v 1";
    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "B" });
    const dates = new Set(result.matches.map((m) => m.date));
    expect(dates.has("2026-04-26")).toBe(true);
    expect(dates.has("2026-05-03")).toBe(true);
  });

  it("does not flag header-date coverage for columns filled with placeholder text only", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.getRow(1).getCell(1).value = "1. Alice";
    ws.getRow(2).getCell(1).value = "2. Bob";
    const header = ws.getRow(4);
    header.getCell(1).value = "Match Time:";
    header.getCell(2).value = "May 3rd";
    header.getCell(3).value = "May 24th";
    header.getCell(4).value = "June 21st";
    const matchRow = ws.getRow(5);
    matchRow.getCell(1).value = "6:00pm Blue Ct";
    matchRow.getCell(2).value = "1 v 2";
    matchRow.getCell(3).value = "Memorial Day Holiday";
    matchRow.getCell(4).value = "Playoffs Schedule TBD";
    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "B" });
    expect(result.anomalies.some((a) => a.includes("Header advertises"))).toBe(false);
    expect(result.matches).toHaveLength(1);
  });

  it("flags header-date coverage when a column has matchup-shaped cells but none parse", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.getRow(1).getCell(1).value = "1. Alice";
    ws.getRow(2).getCell(1).value = "2. Bob";
    const header = ws.getRow(4);
    header.getCell(1).value = "Match Time:";
    header.getCell(2).value = "May 3rd";
    header.getCell(3).value = "May 10th";
    const matchRow = ws.getRow(5);
    matchRow.getCell(1).value = "6:00pm Blue Ct";
    matchRow.getCell(2).value = "1 v 2";
    matchRow.getCell(3).value = "1 v 2 (TBD)";
    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const result = await parseLeagueWorkbook({ buffer, year: 2026, defaultDivision: "B" });
    expect(result.anomalies.some((a) => a.includes("Header advertises 2026-05-10"))).toBe(true);
  });

  it("accepts forward slash and pipe separators in the legend", async () => {
    const buffer = await buildStubWorkbook({
      teams: [
        { number: 1, captain: "Alice" },
        { number: 2, captain: "Bob" },
        { number: 3, captain: "Cat" },
      ],
      legendRows: ["Teams 1-1 / B League", "Teams 2-2 | BB League", "Teams 3-3 \\ BBB League"],
    });
    const result = await parseLeagueWorkbook({ buffer, year: 2026 });
    expect(result.teams.map((t) => t.division)).toEqual(["B", "BB", "BBB"]);
  });
});
