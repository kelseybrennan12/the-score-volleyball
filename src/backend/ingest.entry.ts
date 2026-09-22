import { LEAGUE_SOURCES } from "@/backend/logic/core/league-sources";
import { runIngestion } from "@/backend/logic/services/ingestion";
import { createIngestionDeps } from "@/backend/runtime/bootstrap/ingestion";
import type { IngestionOutcome } from "@/shared/domain/ingestion";

interface CliArgs {
  league: string | null;
  dryRun: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Reject an unknown --league before wiring the environment, so it exits 2 even where the store cannot be built.
  const sources = args.league ? LEAGUE_SOURCES.filter((s) => s.slug === args.league) : LEAGUE_SOURCES;
  if (sources.length === 0) {
    console.error(`No leagues match --league=${args.league}`);
    process.exit(2);
  }

  const outcome = await runIngestion({ ...createIngestionDeps(), trigger: "cli", sources, dryRun: args.dryRun });
  printSummary(outcome);
  const anyFailed = outcome.status === "ran" && outcome.leagues.some((l) => !l.ok);
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

function printSummary(outcome: IngestionOutcome): void {
  // The CLI trigger is exempt from the cooldown, so a skip is not expected here; report it rather than print nothing.
  if (outcome.status === "skipped") {
    console.log(`\nIngest skipped (${outcome.reason}); last ingested ${outcome.lastIngestedAt}.`);
    return;
  }
  console.log(`\nIngest summary${outcome.dryRun ? " (dry-run)" : ""}:`);
  for (const league of outcome.leagues) {
    if (league.ok) {
      console.log(
        `  [ok] ${league.slug} teams=${league.teamCount} matches=${league.matchCount} rosterDiff=${league.rosterDiff}`,
      );
      for (const note of league.anomalies) console.log(`       anomaly: ${note}`);
    } else {
      console.log(`  [failed] ${league.slug}: ${league.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
