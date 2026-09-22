/**
 * The Ingestion contract shared by the backend module, its HTTP routes, and the Admin page: which entrypoint started a
 * run, what the run reports, and the cooldown between runs. No storage keys appear here.
 */

/** Minimum time between two Admin- or cron-started runs. The CLI is exempt. */
export const INGEST_COOLDOWN_MS = 5 * 60 * 1000;

/** Which entrypoint asked for the run. Decides whether the cooldown applies. */
export type IngestionTrigger = "cli" | "cron" | "admin";

/** Whether a league's team list differs from its previous snapshot. */
export type RosterDiff = "same" | "changed";

/** One league's result within a run. A failed league does not abort the run. */
export type LeagueOutcome =
  | { slug: string; ok: true; teamCount: number; matchCount: number; rosterDiff: RosterDiff; anomalies: string[] }
  | { slug: string; ok: false; error: string };

export type IngestionOutcome =
  | { status: "ran"; ranAt: string; dryRun: boolean; leagues: LeagueOutcome[] }
  | { status: "skipped"; reason: "cooldown"; lastIngestedAt: string; retryAfterMs: number };
