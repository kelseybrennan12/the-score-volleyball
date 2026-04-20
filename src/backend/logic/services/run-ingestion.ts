import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { parseLeagueWorkbook } from "@/backend/logic/core/parse";
import { diffRoster } from "@/backend/logic/core/roster-diff";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import type { SnapshotRepo } from "@/backend/runtime/adapters/snapshots/port";
import type { Snapshot } from "@/shared/domain/snapshot";

export interface LeagueResult {
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

export interface RunIngestionInput {
  sources: LeagueSource[];
  fetcher: SheetsFetcher;
  repo: SnapshotRepo;
  dryRun?: boolean;
  now?: () => Date;
}

export interface RunIngestionResult {
  results: LeagueResult[];
  ranAt: string;
}

export async function runIngestion({
  sources,
  fetcher,
  repo,
  dryRun = false,
  now = () => new Date(),
}: RunIngestionInput): Promise<RunIngestionResult> {
  const results: LeagueResult[] = [];
  for (const source of sources) {
    results.push(await ingestOne(source, fetcher, repo, dryRun, now));
  }
  const ranAt = now().toISOString();
  if (!dryRun) {
    await repo.setLastIngestedAt(ranAt);
  }
  return { results, ranAt };
}

async function ingestOne(
  source: LeagueSource,
  fetcher: SheetsFetcher,
  repo: SnapshotRepo,
  dryRun: boolean,
  now: () => Date,
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
      ingestedAt: now().toISOString(),
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
