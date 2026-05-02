import { LEAGUE_SOURCES } from "@/backend/logic/core/league-sources";
import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { runIngestion } from "@/backend/logic/services/run-ingestion";
import { INGEST_COOLDOWN_MS } from "@/backend/logic/services/runtime-ingestion-config";
import { createSheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { resolveSnapshotRepo } from "@/backend/runtime/adapters/snapshots";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  try {
    const repo = resolveSnapshotRepo();
    const last = await repo.getLastIngestedAt();
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < INGEST_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((INGEST_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          {
            error: "Ingest is rate-limited. Try again in a few minutes.",
            retryAfterSeconds,
            lastIngestedAt: last,
          },
          { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
        );
      }
    }

    const fetcher = createSheetsFetcher();
    const { results, ranAt } = await runIngestion({ sources: LEAGUE_SOURCES, fetcher, repo });
    const anyFailed = results.some((r) => !r.ok);
    return NextResponse.json({
      ok: !anyFailed,
      lastIngestedAt: ranAt,
      results: results.map((r) => ({
        slug: r.slug,
        ok: r.ok,
        teamCount: r.teamCount,
        matchCount: r.matchCount,
        rosterDiff: r.rosterDiff,
        anomalies: r.anomalies,
        error: r.error,
      })),
    });
  } catch (err) {
    console.error("Ingest route failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed with an unknown error." },
      { status: 500 },
    );
  }
}
