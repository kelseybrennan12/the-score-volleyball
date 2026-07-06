import { seasonKeyFor } from "@/shared/domain/seasons";
import type { Snapshot } from "@/shared/domain/snapshot";
import { resolveSnapshotRepo } from "./runtime/adapters/snapshots";
import type { PromoteResult } from "./runtime/adapters/snapshots/port";

interface CliArgs {
  season: string | null;
  dryRun: boolean;
}

interface LeagueOutcome {
  slug: string;
  promoted: boolean;
  seasonPath?: string | null;
  deletedArchiveCount?: number;
  wouldDeleteArchiveCount?: number;
  error?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.season) {
    console.error("Missing required --season <session>-<year> (e.g. --season spring-2026)");
    process.exit(2);
  }

  const repo = resolveSnapshotRepo();
  const active = await repo.listActive();
  const matching = active.filter((s) => seasonKeyFor(s.league.session, s.league.year) === args.season);

  if (matching.length === 0) {
    console.log(`No active leagues match season ${args.season}; nothing to archive.`);
    process.exit(0);
  }

  const outcomes: LeagueOutcome[] = [];
  for (const snapshot of matching) {
    outcomes.push(await promoteOne(snapshot, args, repo));
  }

  printSummary(args, outcomes);
  process.exit(outcomes.some((o) => o.error) ? 1 : 0);
}

async function promoteOne(
  snapshot: Snapshot,
  args: CliArgs,
  repo: ReturnType<typeof resolveSnapshotRepo>,
): Promise<LeagueOutcome> {
  const slug = snapshot.league.slug;
  try {
    if (args.dryRun) {
      // Count every rollback archive entry that a real run would purge (bypass the default limit).
      const entries = await repo.listArchive(slug, Number.MAX_SAFE_INTEGER);
      return { slug, promoted: false, wouldDeleteArchiveCount: entries.length };
    }
    const result: PromoteResult = await repo.promoteActiveToSeason(args.season!, slug);
    return {
      slug,
      promoted: result.deletedActive,
      seasonPath: result.seasonPath,
      deletedArchiveCount: result.deletedArchiveCount,
    };
  } catch (err) {
    return { slug, promoted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { season: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") continue;
    if (token === "--dry-run") out.dryRun = true;
    else if (token === "--season") out.season = argv[++i] ?? null;
    else if (token.startsWith("--season=")) out.season = token.slice("--season=".length);
    else throw new Error(`Unknown arg: ${token}`);
  }
  return out;
}

function printSummary(args: CliArgs, outcomes: LeagueOutcome[]): void {
  console.log(`\nArchive-season summary${args.dryRun ? " (dry-run)" : ""} for ${args.season}:`);
  for (const o of outcomes) {
    if (o.error) {
      console.log(`  [failed] ${o.slug}: ${o.error}`);
    } else if (args.dryRun) {
      console.log(`  [dry-run] ${o.slug} would freeze active + purge ${o.wouldDeleteArchiveCount} archive copies`);
    } else {
      console.log(`  [ok] ${o.slug} frozen=${o.seasonPath} purgedArchives=${o.deletedArchiveCount}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
