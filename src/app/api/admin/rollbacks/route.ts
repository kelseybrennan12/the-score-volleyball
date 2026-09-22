import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { createSnapshotStore } from "@/backend/logic/services/snapshot-store";
import { resolveObjectStore } from "@/backend/runtime/adapters/object-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  try {
    const repo = createSnapshotStore(resolveObjectStore());
    const active = await repo.listActive();
    const lastIngestedAt = await repo.getLastIngestedAt();
    const leagues = await Promise.all(
      active
        .sort((a, b) => a.league.displayName.localeCompare(b.league.displayName))
        .map(async (snapshot) => ({
          slug: snapshot.league.slug,
          displayName: snapshot.league.displayName,
          activeIngestedAt: snapshot.ingestedAt,
          archive: await repo.listArchive(snapshot.league.slug),
        })),
    );
    return NextResponse.json({ lastIngestedAt, leagues });
  } catch (err) {
    console.error("Rollbacks route failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load rollbacks." },
      { status: 500 },
    );
  }
}
