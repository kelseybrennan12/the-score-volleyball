import { runIngestion } from "@/backend/logic/services/ingestion";
import { authorizeCronRequest, toCronIngestResponse } from "@/backend/logic/services/ingestion-http";
import { createIngestionDeps } from "@/backend/runtime/bootstrap/ingestion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const auth = authorizeCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const response = toCronIngestResponse(await runIngestion({ trigger: "cron", ...createIngestionDeps() }));
    return NextResponse.json(response.body, { status: response.status });
  } catch (err) {
    console.error("Cron ingest route failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown ingest failure" }, { status: 500 });
  }
}
