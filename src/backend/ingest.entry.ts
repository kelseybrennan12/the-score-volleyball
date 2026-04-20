import path from "node:path";
import { LEAGUE_SOURCES } from "./logic/core/league-sources";
import { runIngestion, type LeagueResult } from "./logic/services/run-ingestion";
import { createSheetsFetcher } from "./runtime/adapters/integrations/google-sheets";
import { createSnapshotRepo } from "./runtime/adapters/snapshots/fs";

interface CliArgs {
  league: string | null;
  dryRun: boolean;
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

  const { results } = await runIngestion({ sources, fetcher, repo, dryRun: args.dryRun });
  printSummary(results, args.dryRun);
  const anyFailed = results.some((r) => !r.ok);
  process.exit(anyFailed ? 1 : 0);
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
