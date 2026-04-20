import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export interface AdminConfig {
  passphrase: string;
  cookieSecret: string;
}

export function loadAdminConfig(): AdminConfig | null {
  const passphrase = process.env.ADMIN_PASSPHRASE;
  const cookieSecret = process.env.ADMIN_COOKIE_SECRET;
  if (!passphrase || !cookieSecret) return null;
  return { passphrase, cookieSecret };
}

export function passphrasesMatch(expected: string, received: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function signSession(cookieSecret: string, issuedAtMs: number): string {
  const hmac = createHmac("sha256", cookieSecret);
  hmac.update(String(issuedAtMs));
  return `${issuedAtMs}.${hmac.digest("hex")}`;
}

export function verifySession(
  cookieSecret: string,
  cookieValue: string | undefined,
  nowMs: number = Date.now(),
): { valid: true; issuedAtMs: number } | { valid: false; reason: "missing" | "malformed" | "signature" | "expired" } {
  if (!cookieValue) return { valid: false, reason: "missing" };
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex <= 0) return { valid: false, reason: "malformed" };
  const issuedAtStr = cookieValue.slice(0, dotIndex);
  const signatureHex = cookieValue.slice(dotIndex + 1);
  const issuedAtMs = Number(issuedAtStr);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return { valid: false, reason: "malformed" };
  const expected = createHmac("sha256", cookieSecret).update(issuedAtStr).digest("hex");
  if (signatureHex.length !== expected.length) return { valid: false, reason: "signature" };
  const a = Buffer.from(signatureHex, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: "signature" };
  if (nowMs - issuedAtMs > SESSION_MAX_AGE_MS) return { valid: false, reason: "expired" };
  return { valid: true, issuedAtMs };
}
