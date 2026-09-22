import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { parseLeagueWorkbook } from "@/backend/logic/core/parse";
import { diffRoster } from "@/backend/logic/core/roster-diff";
import type { SnapshotStore } from "@/backend/logic/services/snapshot-store";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import {
  INGEST_COOLDOWN_MS,
  type IngestionOutcome,
  type IngestionTrigger,
  type LeagueOutcome,
} from "@/shared/domain/ingestion";
import type { Snapshot } from "@/shared/domain/snapshot";

/** What Ingestion needs from the environment; tests supply fakes, the bootstrap supplies the real ones. */
export interface IngestionDeps {
  sources: LeagueSource[];
  fetcher: SheetsFetcher;
  store: SnapshotStore;
}

export interface RunIngestionInput extends IngestionDeps {
  trigger: IngestionTrigger;
  dryRun?: boolean;
  now?: () => Date;
}

/**
 * Ingestion: fetch each league's spreadsheet, parse it, and make the result the league's live snapshot (archiving the
 * previous one), then stamp the run. Admin- and cron-started runs are refused inside the cooldown since the last stamp;
 * the CLI is exempt. A failed league is reported, not thrown; only a failure of the store itself throws.
 */
export async function runIngestion({
  trigger,
  sources,
  fetcher,
  store,
  dryRun = false,
  now = () => new Date(),
}: RunIngestionInput): Promise<IngestionOutcome> {
  if (trigger !== "cli") {
    const lastIngestedAt = await store.getLastIngestedAt();
    if (lastIngestedAt) {
      const retryAfterMs = INGEST_COOLDOWN_MS - (now().getTime() - new Date(lastIngestedAt).getTime());
      if (retryAfterMs > 0) return { status: "skipped", reason: "cooldown", lastIngestedAt, retryAfterMs };
    }
  }
  const leagues: LeagueOutcome[] = [];
  for (const source of sources) {
    leagues.push(await ingestLeague(source, fetcher, store, dryRun, now));
  }
  const ranAt = now().toISOString();
  if (!dryRun) await store.setLastIngestedAt(ranAt);
  return { status: "ran", ranAt, dryRun, leagues };
}

async function ingestLeague(
  source: LeagueSource,
  fetcher: SheetsFetcher,
  store: SnapshotStore,
  dryRun: boolean,
  now: () => Date,
): Promise<LeagueOutcome> {
  try {
    const buffer = await fetcher.fetchXlsx(source.sheetId);
    const parsed = await parseLeagueWorkbook({
      buffer,
      year: source.year,
      defaultDivision: source.defaultDivision,
    });
    const prev = await store.readActive(source.slug);
    const rosterDiff = diffRoster(prev?.teams ?? null, parsed.teams);
    if (!dryRun) {
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
      await store.archiveExisting(source.slug);
      await store.writeActive(snapshot);
    }
    return {
      slug: source.slug,
      ok: true,
      teamCount: parsed.teams.length,
      matchCount: parsed.matches.length,
      rosterDiff,
      anomalies: parsed.anomalies,
    };
  } catch (err) {
    return { slug: source.slug, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
