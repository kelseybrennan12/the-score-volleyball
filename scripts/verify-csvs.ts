import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseMonthDay, parseTimeLabel } from "../src/backend/logic/core/date-parse";
import type { Snapshot } from "../src/shared/domain/snapshot";

const TMP_DIR = path.resolve(process.cwd(), "tmp");
const SNAPSHOT_DIR = path.resolve(process.cwd(), "data/snapshots/active");

type MatchKey = `${string}|${string}|${string}`;

interface CsvMatch {
  date: string;
  time: string;
  court: string;
  teams: [number, number];
}

interface Job {
  csvPath: string;
  slug: string;
}

interface LeagueResult {
  slug: string;
  csvCount: number;
  snapshotCount: number;
  onlyInCsv: MatchKey[];
  onlyInSnapshot: MatchKey[];
  pairDiffs: { slot: MatchKey; csv: string; snapshot: string }[];
  orderDiffs: { slot: MatchKey; csv: string; snapshot: string }[];
}

const WEEKDAY_TO_SLUG: Record<string, string> = {
  sunday: "spring-sundays",
  monday: "spring-mondays",
  tuesday: "spring-tuesdays",
  wednesday: "spring-wednesdays",
  thursday: "spring-thursdays",
  friday: "spring-fridays",
};

function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

function parseCsv(text: string, year: number, label: string): CsvMatch[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  if (!/match\s*time/i.test(header[0])) {
    throw new Error(`${label}: unexpected CSV header: ${lines[0]}`);
  }
  const dateByCol = new Map<number, string>();
  for (let c = 1; c < header.length; c++) {
    const iso = parseMonthDay(header[c], year);
    if (iso) dateByCol.set(c, iso);
  }
  const out: CsvMatch[] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = splitCsvLine(lines[r]);
    const timeLabel = parseTimeLabel(row[0].replace(/\s+/g, " "));
    if (!timeLabel) continue;
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

function slugForCsv(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [day, slug] of Object.entries(WEEKDAY_TO_SLUG)) {
    if (lower.includes(day)) return slug;
  }
  return null;
}

async function discoverJobs(): Promise<Job[]> {
  let entries: string[];
  try {
    entries = await readdir(TMP_DIR);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      console.error(`No tmp/ directory at ${TMP_DIR}. Drop CSV exports there and re-run.`);
      process.exit(2);
    }
    throw err;
  }
  const csvs = entries.filter((n) => n.toLowerCase().endsWith(".csv"));
  if (csvs.length === 0) {
    console.error(`No CSVs found in ${TMP_DIR}.`);
    process.exit(2);
  }
  const jobs: Job[] = [];
  for (const name of csvs) {
    const slug = slugForCsv(name);
    if (!slug) {
      console.warn(`Skipping ${name}: cannot map filename to a league slug.`);
      continue;
    }
    jobs.push({ csvPath: path.join(TMP_DIR, name), slug });
  }
  return jobs.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function verifyOne(job: Job): Promise<LeagueResult> {
  const snapshotPath = path.join(SNAPSHOT_DIR, `${job.slug}.json`);
  const [csvRaw, snapshotRaw] = await Promise.all([readFile(job.csvPath, "utf8"), readFile(snapshotPath, "utf8")]);
  const snapshot: Snapshot = JSON.parse(snapshotRaw);
  const csvMatches = parseCsv(csvRaw, snapshot.league.year, job.slug);

  const csvBySlot = new Map<MatchKey, CsvMatch>();
  for (const m of csvMatches) csvBySlot.set(key(m.date, m.time, m.court), m);
  const snapshotBySlot = new Map<MatchKey, { teams: [number, number] }>();
  for (const m of snapshot.matches) snapshotBySlot.set(key(m.date, m.time, m.court), { teams: m.teamNumbers });

  const onlyInCsv: MatchKey[] = [];
  const onlyInSnapshot: MatchKey[] = [];
  const pairDiffs: LeagueResult["pairDiffs"] = [];
  const orderDiffs: LeagueResult["orderDiffs"] = [];

  for (const [k, csvMatch] of csvBySlot) {
    const snap = snapshotBySlot.get(k);
    if (!snap) {
      onlyInCsv.push(k);
      continue;
    }
    const csvPair = normalizePair(csvMatch.teams[0], csvMatch.teams[1]);
    const snapPair = normalizePair(snap.teams[0], snap.teams[1]);
    const csvStr = `${csvMatch.teams[0]} v ${csvMatch.teams[1]}`;
    const snapStr = `${snap.teams[0]} v ${snap.teams[1]}`;
    if (csvPair !== snapPair) {
      pairDiffs.push({ slot: k, csv: csvStr, snapshot: snapStr });
    } else if (csvMatch.teams[0] !== snap.teams[0]) {
      orderDiffs.push({ slot: k, csv: csvStr, snapshot: snapStr });
    }
  }
  for (const k of snapshotBySlot.keys()) {
    if (!csvBySlot.has(k)) onlyInSnapshot.push(k);
  }

  return {
    slug: job.slug,
    csvCount: csvMatches.length,
    snapshotCount: snapshot.matches.length,
    onlyInCsv,
    onlyInSnapshot,
    pairDiffs,
    orderDiffs,
  };
}

function renderResult(result: LeagueResult): boolean {
  const hasHardFailures =
    result.onlyInCsv.length > 0 || result.onlyInSnapshot.length > 0 || result.pairDiffs.length > 0;
  const statusIcon = hasHardFailures ? "❌" : "✅";
  console.log(
    `\n${statusIcon} ${result.slug}  csv=${result.csvCount} snapshot=${result.snapshotCount}` +
      (result.orderDiffs.length > 0
        ? `  (${result.orderDiffs.length} team-order diff${result.orderDiffs.length === 1 ? "" : "s"} — expected for played matches)`
        : ""),
  );
  if (result.onlyInCsv.length > 0) {
    console.log(`  Slots only in CSV (${result.onlyInCsv.length}):`);
    for (const k of result.onlyInCsv.sort().slice(0, 20)) console.log(`    ${k}`);
    if (result.onlyInCsv.length > 20) console.log(`    … and ${result.onlyInCsv.length - 20} more`);
  }
  if (result.onlyInSnapshot.length > 0) {
    console.log(`  Slots only in snapshot (${result.onlyInSnapshot.length}):`);
    for (const k of result.onlyInSnapshot.sort().slice(0, 20)) console.log(`    ${k}`);
    if (result.onlyInSnapshot.length > 20) console.log(`    … and ${result.onlyInSnapshot.length - 20} more`);
  }
  if (result.pairDiffs.length > 0) {
    console.log(`  Matchup differences (${result.pairDiffs.length}):`);
    for (const t of result.pairDiffs) console.log(`    ${t.slot}  csv=${t.csv}  snapshot=${t.snapshot}`);
  }
  return hasHardFailures;
}

async function main(): Promise<void> {
  const jobs = await discoverJobs();
  let anyFailed = false;
  for (const job of jobs) {
    try {
      const result = await verifyOne(job);
      const failed = renderResult(result);
      if (failed) anyFailed = true;
    } catch (err) {
      anyFailed = true;
      console.log(`\n❌ ${job.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n${anyFailed ? "❌ One or more leagues differ from their CSVs." : "✅ Every league matches its CSV."}`);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
