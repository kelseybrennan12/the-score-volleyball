import type { Snapshot } from "@/shared/domain/snapshot";
import path from "node:path";
import { LEAGUE_SOURCES, type LeagueSource } from "./logic/core/league-sources";
import { parseLeagueWorkbook } from "./logic/core/parse";
import { diffRoster } from "./logic/core/roster-diff";
import { createSheetsFetcher, type SheetsFetcher } from "./runtime/adapters/integrations/google-sheets";
import { createSnapshotRepo, type SnapshotRepo } from "./runtime/adapters/snapshots/fs";

interface CliArgs {
  league: string | null;
  dryRun: boolean;
}

interface LeagueResult {
  slug: string;
  ok: boolean;
  activePath?: string;
  archivedPath?: string | null;
  teamCount?: number;
  matchCount?: number;
  rosterDiff?: "same" | "changed";
  anomalies?: string[];
  error?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sources = args.league ? LEAGUE_SOURCES.filter((s) => s.slug === args.league) : LEAGUE_SOURCES;
  if (sources.length === 0) {
    console.error(`No leagues match --league=${args.league}`);
    process.exit(2);
  }
  const fetcher = createSheetsFetcher();
  const repo = createSnapshotRepo(path.resolve(process.cwd(), "data/snapshots"));

  const results: LeagueResult[] = [];
  for (const source of sources) {
    results.push(await ingestOne(source, fetcher, repo, args.dryRun));
  }
  printSummary(results, args.dryRun);
  const anyFailed = results.some((r) => !r.ok);
  process.exit(anyFailed ? 1 : 0);
}

async function ingestOne(
  source: LeagueSource,
  fetcher: SheetsFetcher,
  repo: SnapshotRepo,
  dryRun: boolean,
): Promise<LeagueResult> {
  try {
    const buffer = await fetcher.fetchXlsx(source.sheetId);
    const parsed = await parseLeagueWorkbook({
      buffer,
      year: source.year,
      defaultDivision: source.defaultDivision,
    });
    const prev = await repo.readActive(source.slug);
    const rosterDiff = diffRoster(prev?.teams ?? null, parsed.teams);
    const snapshot: Snapshot = {
      schemaVersion: 1,
      league: {
        slug: source.slug,
        displayName: source.displayName,
        day: source.day,
        session: source.session,
        year: source.year,
        sourceSheetId: source.sheetId,
      },
      ingestedAt: new Date().toISOString(),
      teams: parsed.teams,
      matches: parsed.matches,
    };
    if (dryRun) {
      return {
        slug: source.slug,
        ok: true,
        teamCount: parsed.teams.length,
        matchCount: parsed.matches.length,
        rosterDiff,
        anomalies: parsed.anomalies,
      };
    }
    const archivedPath = await repo.archiveExisting(source.slug);
    const activePath = await repo.writeActive(snapshot);
    return {
      slug: source.slug,
      ok: true,
      activePath,
      archivedPath,
      teamCount: parsed.teams.length,
      matchCount: parsed.matches.length,
      rosterDiff,
      anomalies: parsed.anomalies,
    };
  } catch (err) {
    return { slug: source.slug, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { league: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") continue;
    if (token === "--dry-run") out.dryRun = true;
    else if (token === "--league") out.league = argv[++i] ?? null;
    else if (token.startsWith("--league=")) out.league = token.slice("--league=".length);
    else throw new Error(`Unknown arg: ${token}`);
  }
  return out;
}

function printSummary(results: LeagueResult[], dryRun: boolean): void {
  console.log(`\nIngest summary${dryRun ? " (dry-run)" : ""}:`);
  for (const r of results) {
    if (r.ok) {
      const archived = r.archivedPath ? ` archived=${r.archivedPath}` : "";
      const active = r.activePath ? ` active=${r.activePath}` : "";
      console.log(
        `  [ok] ${r.slug} teams=${r.teamCount} matches=${r.matchCount} rosterDiff=${r.rosterDiff}${active}${archived}`,
      );
      if (r.anomalies?.length) {
        for (const note of r.anomalies) console.log(`       anomaly: ${note}`);
      }
    } else {
      console.log(`  [failed] ${r.slug}: ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
