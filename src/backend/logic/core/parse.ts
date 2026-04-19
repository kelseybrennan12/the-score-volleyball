import type { Match, Team } from "@/shared/domain/snapshot";
import ExcelJS from "exceljs";
import { parseMonthDay, parseTimeLabel } from "./date-parse";
import { deriveOutcome } from "./outcome";

export interface ParseInput {
  buffer: Buffer;
  year: number;
  defaultDivision?: string;
}

export interface ParseResult {
  teams: Team[];
  matches: Match[];
  anomalies: string[];
}

const TEAM_ROW_PATTERN = /^\s*(\d+)\.\s*(.+?)\s*$/;
const MATCHUP_PATTERN = /^\s*(\d+)\s*v\s*(\d+)\s*$/i;
const DIVISION_PATTERN = /\bDivision\b/i;
const MATCH_TIME_HEADER = /^match\s*time:?$/i;

export async function parseLeagueWorkbook(input: ParseInput): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = input.buffer.buffer.slice(
    input.buffer.byteOffset,
    input.buffer.byteOffset + input.buffer.byteLength,
  );
  await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Workbook has no worksheets");

  const anomalies: string[] = [];
  const teams = parseTeams(worksheet, input.defaultDivision ?? "A", anomalies);
  const matches = parseSchedule(worksheet, input.year, anomalies);
  return { teams, matches, anomalies };
}

function parseTeams(ws: ExcelJS.Worksheet, defaultDivision: string, anomalies: string[]): Team[] {
  const byNumber = new Map<number, Team>();
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const aText = cellText(row.getCell(1));
    if (!aText) continue;
    if (MATCH_TIME_HEADER.test(aText)) break;
    const teamMatch = aText.match(TEAM_ROW_PATTERN);
    if (!teamMatch) continue;
    const number = Number.parseInt(teamMatch[1], 10);
    const captain = teamMatch[2].replace(/\s+/g, " ").trim();
    if (!Number.isFinite(number) || captain.length === 0) continue;
    if (byNumber.has(number)) {
      anomalies.push(
        `Duplicate team number ${number} at row ${r}; keeping first captain "${byNumber.get(number)!.captain}"`,
      );
      continue;
    }
    const division = findDivisionInRow(row) ?? defaultDivision;
    byNumber.set(number, { number, captain, division });
  }
  const teams = [...byNumber.values()].sort((a, b) => a.number - b.number);
  if (teams.length === 0) anomalies.push("No team rows parsed from standings block");
  return teams;
}

function findDivisionInRow(row: ExcelJS.Row): string | null {
  for (let c = 2; c <= Math.max(row.cellCount, 8); c++) {
    const text = cellText(row.getCell(c));
    if (text && DIVISION_PATTERN.test(text)) {
      return text.replace(/\s*Division\s*$/i, "").trim();
    }
  }
  return null;
}

function parseSchedule(ws: ExcelJS.Worksheet, year: number, anomalies: string[]): Match[] {
  const matches: Match[] = [];
  const headerRowIndex = findHeaderRow(ws);
  if (headerRowIndex === null) {
    anomalies.push('Schedule header row ("Match Time:") not found');
    return matches;
  }
  const headerRow = ws.getRow(headerRowIndex);
  const dateByColumn = new Map<number, string>();
  for (let c = 2; c <= ws.columnCount; c++) {
    const text = cellText(headerRow.getCell(c));
    if (!text) continue;
    const iso = parseMonthDay(text, year);
    if (iso) dateByColumn.set(c, iso);
  }
  if (dateByColumn.size === 0) {
    anomalies.push("No parseable date columns in schedule header row");
    return matches;
  }

  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const aText = cellText(row.getCell(1));
    if (!aText) continue;
    if (MATCH_TIME_HEADER.test(aText)) break;
    const timeLabel = parseTimeLabel(aText);
    if (!timeLabel) continue;
    for (const [col, date] of dateByColumn) {
      const cell = row.getCell(col);
      const text = cellText(cell);
      if (!text) continue;
      const matchup = text.match(MATCHUP_PATTERN);
      if (!matchup) continue;
      const a = Number.parseInt(matchup[1], 10);
      const b = Number.parseInt(matchup[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const fillArgb = readFillArgb(cell);
      const { outcome } = deriveOutcome({ teamNumbers: [a, b], fillArgb });
      matches.push({
        date,
        time: timeLabel.time,
        court: timeLabel.court,
        teamNumbers: [a, b],
        outcome,
      });
    }
  }
  return matches;
}

function findHeaderRow(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= ws.rowCount; r++) {
    const text = cellText(ws.getRow(r).getCell(1));
    if (text && MATCH_TIME_HEADER.test(text)) return r;
  }
  return null;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray((v as { richText: { text: string }[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText
        .map((rt) => rt.text)
        .join("")
        .trim();
    }
    if ("text" in v) return String((v as { text: unknown }).text).trim();
    if ("result" in v) return String((v as { result: unknown }).result).trim();
  }
  return "";
}

function readFillArgb(cell: ExcelJS.Cell): string | null {
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
  return fill?.fgColor?.argb ?? null;
}
