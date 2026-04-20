import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { resolveSnapshotRepo } from "@/backend/runtime/adapters/snapshots";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  let body: { slug?: unknown; archiveKey?: unknown };
  try {
    body = (await request.json()) as { slug?: unknown; archiveKey?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : null;
  const archiveKey = typeof body.archiveKey === "string" ? body.archiveKey : null;
  if (!slug || !archiveKey) {
    return NextResponse.json({ error: "slug and archiveKey are required." }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+\.json$/.test(archiveKey)) {
    return NextResponse.json({ error: "Invalid slug or archiveKey." }, { status: 400 });
  }

  const repo = resolveSnapshotRepo();
  try {
    const result = await repo.restoreArchive(slug, archiveKey);
    return NextResponse.json({ ok: true, activePath: result.activePath, archivedPath: result.archivedPath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Rollback failed." }, { status: 500 });
  }
}
