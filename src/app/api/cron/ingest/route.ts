import { LEAGUE_SOURCES } from "@/backend/logic/core/league-sources";
import { handleCronIngest } from "@/backend/logic/services/cron-ingest";
import { createSheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { resolveSnapshotRepo } from "@/backend/runtime/adapters/snapshots";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const result = await handleCronIngest({
    authorization: req.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
    sources: LEAGUE_SOURCES,
    fetcher: createSheetsFetcher(),
    repo: resolveSnapshotRepo(),
  });
  return NextResponse.json(result.body, { status: result.status });
}
