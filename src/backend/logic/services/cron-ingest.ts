import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { runIngestion, type LeagueResult } from "@/backend/logic/services/run-ingestion";
import { INGEST_COOLDOWN_MS } from "@/backend/logic/services/runtime-ingestion-config";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import type { SnapshotRepo } from "@/backend/runtime/adapters/snapshots/port";
import { timingSafeEqual } from "node:crypto";

export interface CronIngestInput {
  authorization: string | null;
  cronSecret: string | undefined;
  sources: LeagueSource[];
  fetcher: SheetsFetcher;
  repo: SnapshotRepo;
  now?: () => Date;
}

interface SuccessBody {
  ok: true;
  skipped?: boolean;
  reason?: string;
  lastIngestedAt: string | null;
  results?: LeagueResult[];
}

interface ErrorBody {
  error: string;
}

export interface CronIngestResult {
  status: number;
  body: SuccessBody | ErrorBody;
}

export async function handleCronIngest(input: CronIngestInput): Promise<CronIngestResult> {
  if (!input.cronSecret) {
    return { status: 503, body: { error: "CRON_SECRET not configured" } };
  }
  if (!isAuthorized(input.authorization, input.cronSecret)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  try {
    const last = await input.repo.getLastIngestedAt();
    if (last) {
      const elapsed = (input.now?.().getTime() ?? Date.now()) - new Date(last).getTime();
      if (elapsed < INGEST_COOLDOWN_MS) {
        return {
          status: 200,
          body: { ok: true, skipped: true, reason: "cooldown", lastIngestedAt: last },
        };
      }
    }

    const { results, ranAt } = await runIngestion({
      sources: input.sources,
      fetcher: input.fetcher,
      repo: input.repo,
      now: input.now,
    });
    return {
      status: 200,
      body: { ok: true, lastIngestedAt: ranAt, results },
    };
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : "Unknown ingest failure" } };
  }
}

function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
