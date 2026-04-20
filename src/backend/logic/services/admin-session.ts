import { cookies } from "next/headers";
import { loadAdminConfig, SESSION_COOKIE_NAME, verifySession, type AdminConfig } from "./admin-auth";

export type AdminRequestGuard = { ok: true; config: AdminConfig } | { ok: false; status: 401 | 503; reason: string };

export async function requireAdminRequest(): Promise<AdminRequestGuard> {
  const config = loadAdminConfig();
  if (!config) return { ok: false, status: 503, reason: "Admin endpoints are not configured." };
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;
  const result = verifySession(config.cookieSecret, cookie);
  if (!result.valid) return { ok: false, status: 401, reason: `Unauthorized (${result.reason}).` };
  return { ok: true, config };
}
