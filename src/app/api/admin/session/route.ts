import {
  loadAdminConfig,
  passphrasesMatch,
  SESSION_COOKIE_NAME,
  signSession,
} from "@/backend/logic/services/admin-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const config = loadAdminConfig();
  if (!config) {
    return NextResponse.json({ error: "Admin endpoints are not configured." }, { status: 503 });
  }
  let body: { passphrase?: unknown };
  try {
    body = (await request.json()) as { passphrase?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.passphrase !== "string" || body.passphrase.length === 0) {
    return NextResponse.json({ error: "Passphrase is required." }, { status: 400 });
  }
  if (!passphrasesMatch(config.passphrase, body.passphrase)) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signSession(config.cookieSecret, Date.now()),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
