import path from "node:path";
import { buildReport, type ReportFormat } from "./logic/services/build-team-report";
import { createSnapshotRepo } from "./runtime/adapters/snapshots/fs";

interface CliArgs {
  league: string | null;
  team: number | null;
  format: ReportFormat;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repo = createSnapshotRepo(path.resolve(process.cwd(), "data/snapshots"));
  const snapshots = await repo.listActive();
  if (snapshots.length === 0) {
    console.log("No active snapshots found under data/snapshots/active.");
    process.exit(0);
  }
  const output = buildReport({
    snapshots: snapshots.sort((a, b) => a.league.displayName.localeCompare(b.league.displayName)),
    leagueSlug: args.league ?? undefined,
    teamNumber: args.team ?? undefined,
    format: args.format,
  });
  process.stdout.write(output);
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { league: null, team: null, format: "text" };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") continue;
    if (token === "--league") out.league = argv[++i] ?? null;
    else if (token.startsWith("--league=")) out.league = token.slice("--league=".length);
    else if (token === "--team") out.team = Number.parseInt(argv[++i] ?? "", 10);
    else if (token.startsWith("--team=")) out.team = Number.parseInt(token.slice("--team=".length), 10);
    else if (token === "--format") out.format = normalizeFormat(argv[++i]);
    else if (token.startsWith("--format=")) out.format = normalizeFormat(token.slice("--format=".length));
    else throw new Error(`Unknown arg: ${token}`);
  }
  if (out.team != null && !Number.isFinite(out.team)) {
    throw new Error("--team requires a numeric value");
  }
  return out;
}

function normalizeFormat(raw: string | undefined): ReportFormat {
  if (raw === "md" || raw === "text") return raw;
  throw new Error(`--format must be "text" or "md" (got "${raw ?? ""}")`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
