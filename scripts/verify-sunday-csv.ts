import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseMonthDay, parseTimeLabel } from "../src/backend/logic/core/date-parse";
import type { Snapshot } from "../src/shared/domain/snapshot";

const CSV_PATH = path.resolve(process.cwd(), "tmp/Spring sunday copy - Sheet1.csv");
const SNAPSHOT_PATH = path.resolve(process.cwd(), "data/snapshots/active/spring-sundays.json");
const YEAR = 2026;

type MatchKey = `${string}|${string}|${string}`;

interface CsvMatch {
  date: string;
  time: string;
  court: string;
  teams: [number, number];
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

function parseCsv(text: string): CsvMatch[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  if (!/match\s*time/i.test(header[0])) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }
  const dateByCol = new Map<number, string>();
  for (let c = 1; c < header.length; c++) {
    const iso = parseMonthDay(header[c], YEAR);
    if (iso) dateByCol.set(c, iso);
    else console.warn(`  csv: skipping header column ${c} (${JSON.stringify(header[c])})`);
  }
  const out: CsvMatch[] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = splitCsvLine(lines[r]);
    const timeLabel = parseTimeLabel(row[0].replace(/\s+/g, " "));
    if (!timeLabel) {
      console.warn(`  csv: skipping row ${r + 1} (unrecognized time label: ${JSON.stringify(row[0])})`);
      continue;
    }
    for (const [col, date] of dateByCol) {
      const cell = row[col] ?? "";
      const m = cell.match(/^\s*(\d+)\s*v\s*(\d+)\s*$/i);
      if (!m) continue;
      out.push({
        date,
        time: timeLabel.time,
        court: timeLabel.court,
        teams: [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10)],
      });
    }
  }
  return out;
}

function key(date: string, time: string, court: string): MatchKey {
  return `${date}|${time}|${court}`;
}

function normalizePair(a: number, b: number): string {
  return [a, b].sort((x, y) => x - y).join(" v ");
}

async function readOrExit(filePath: string, label: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      console.error(`Missing ${label} at ${filePath}.`);
      if (filePath === CSV_PATH) {
        console.error(
          `Drop the Spring Sundays CSV export at that path (the filename includes spaces) and re-run the task.`,
        );
      }
      process.exit(2);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const [csvRaw, snapshotRaw] = await Promise.all([
    readOrExit(CSV_PATH, "CSV export"),
    readOrExit(SNAPSHOT_PATH, "active snapshot"),
  ]);
  const csvMatches = parseCsv(csvRaw);
  const snapshot: Snapshot = JSON.parse(snapshotRaw);
  console.log(`CSV matches: ${csvMatches.length}`);
  console.log(`Snapshot matches: ${snapshot.matches.length}`);

  const csvBySlot = new Map<MatchKey, CsvMatch>();
  for (const m of csvMatches) csvBySlot.set(key(m.date, m.time, m.court), m);

  const snapshotBySlot = new Map<MatchKey, { teams: [number, number] }>();
  for (const m of snapshot.matches) snapshotBySlot.set(key(m.date, m.time, m.court), { teams: m.teamNumbers });

  const onlyInCsv: MatchKey[] = [];
  const onlyInSnapshot: MatchKey[] = [];
  const teamMismatches: { slot: MatchKey; csv: string; snapshot: string; exactOrderDiffers: boolean }[] = [];

  for (const [k, csvMatch] of csvBySlot) {
    const snap = snapshotBySlot.get(k);
    if (!snap) {
      onlyInCsv.push(k);
      continue;
    }
    const csvPair = normalizePair(csvMatch.teams[0], csvMatch.teams[1]);
    const snapPair = normalizePair(snap.teams[0], snap.teams[1]);
    if (csvPair !== snapPair) {
      teamMismatches.push({
        slot: k,
        csv: `${csvMatch.teams[0]} v ${csvMatch.teams[1]}`,
        snapshot: `${snap.teams[0]} v ${snap.teams[1]}`,
        exactOrderDiffers: false,
      });
    } else if (csvMatch.teams[0] !== snap.teams[0]) {
      teamMismatches.push({
        slot: k,
        csv: `${csvMatch.teams[0]} v ${csvMatch.teams[1]}`,
        snapshot: `${snap.teams[0]} v ${snap.teams[1]}`,
        exactOrderDiffers: true,
      });
    }
  }
  for (const k of snapshotBySlot.keys()) {
    if (!csvBySlot.has(k)) onlyInSnapshot.push(k);
  }

  if (onlyInCsv.length > 0) {
    console.log(`\nSlots only in CSV (${onlyInCsv.length}):`);
    for (const k of onlyInCsv.sort()) console.log(`  ${k}`);
  }
  if (onlyInSnapshot.length > 0) {
    console.log(`\nSlots only in snapshot (${onlyInSnapshot.length}):`);
    for (const k of onlyInSnapshot.sort()) console.log(`  ${k}`);
  }
  const pairDiffs = teamMismatches.filter((t) => !t.exactOrderDiffers);
  const orderDiffs = teamMismatches.filter((t) => t.exactOrderDiffers);
  if (pairDiffs.length > 0) {
    console.log(`\nMatchup differences (${pairDiffs.length}):`);
    for (const t of pairDiffs) {
      console.log(`  ${t.slot}  csv=${t.csv}  snapshot=${t.snapshot}`);
    }
  }
  if (orderDiffs.length > 0) {
    console.log(`\nTeam-order-only differences — same pair, different first-listed (${orderDiffs.length}):`);
    console.log(`  (expected for played matches: the winner is moved to the first position in the snapshot)`);
    for (const t of orderDiffs) {
      console.log(`  ${t.slot}  csv=${t.csv}  snapshot=${t.snapshot}`);
    }
  }

  const allClean = onlyInCsv.length === 0 && onlyInSnapshot.length === 0 && pairDiffs.length === 0;
  console.log(`\n${allClean ? "✅ CSV and snapshot match on every slot and matchup." : "❌ See differences above."}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
