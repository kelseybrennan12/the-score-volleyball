import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { runIngestion } from "@/backend/logic/services/ingestion";
import { toAdminIngestResponse } from "@/backend/logic/services/ingestion-http";
import { createIngestionDeps } from "@/backend/runtime/bootstrap/ingestion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  try {
    const response = toAdminIngestResponse(await runIngestion({ trigger: "admin", ...createIngestionDeps() }));
    return NextResponse.json(response.body, {
      status: response.status,
      headers: response.status === 429 ? response.headers : undefined,
    });
  } catch (err) {
    console.error("Ingest route failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed with an unknown error." },
      { status: 500 },
    );
  }
}
