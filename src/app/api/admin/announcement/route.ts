import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { createAnnouncementStore, readAnnouncement, saveAnnouncement } from "@/backend/logic/services/announcement";
import { resolveObjectStore } from "@/backend/runtime/adapters/object-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  try {
    const announcement = await readAnnouncement(createAnnouncementStore(resolveObjectStore()));
    return NextResponse.json({ announcement });
  } catch (err) {
    console.error("Announcement read route failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read the announcement." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireAdminRequest();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  let body: { message?: unknown; enabled?: unknown; publishAsNew?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.message !== "string" || typeof body.enabled !== "boolean" || typeof body.publishAsNew !== "boolean") {
    return NextResponse.json(
      { error: "Expected message (string), enabled (boolean), and publishAsNew (boolean)." },
      { status: 400 },
    );
  }

  try {
    const result = await saveAnnouncement({
      message: body.message,
      enabled: body.enabled,
      publishAsNew: body.publishAsNew,
      repo: createAnnouncementStore(resolveObjectStore()),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("Announcement save route failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save the announcement." },
      { status: 500 },
    );
  }
}
