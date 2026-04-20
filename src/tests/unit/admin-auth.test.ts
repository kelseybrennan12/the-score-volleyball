import { SESSION_MAX_AGE_MS, passphrasesMatch, signSession, verifySession } from "@/backend/logic/services/admin-auth";
import { describe, expect, it } from "vitest";

const secret = "test-secret-key";

describe("admin-auth", () => {
  it("passphrasesMatch accepts exact match and rejects otherwise", () => {
    expect(passphrasesMatch("hunter2", "hunter2")).toBe(true);
    expect(passphrasesMatch("hunter2", "hunter3")).toBe(false);
    expect(passphrasesMatch("hunter2", "hunter22")).toBe(false);
  });

  it("signSession round-trips a valid cookie", () => {
    const issuedAt = Date.now();
    const cookie = signSession(secret, issuedAt);
    const result = verifySession(secret, cookie, issuedAt + 1000);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.issuedAtMs).toBe(issuedAt);
  });

  it("verifySession rejects missing cookie", () => {
    const result = verifySession(secret, undefined);
    expect(result).toEqual({ valid: false, reason: "missing" });
  });

  it("verifySession rejects malformed cookie", () => {
    expect(verifySession(secret, "not-a-cookie")).toEqual({ valid: false, reason: "malformed" });
    expect(verifySession(secret, ".badprefix")).toEqual({ valid: false, reason: "malformed" });
  });

  it("verifySession rejects tampered signature", () => {
    const issuedAt = Date.now();
    const cookie = signSession(secret, issuedAt);
    const tampered = cookie.slice(0, -2) + (cookie.endsWith("aa") ? "bb" : "aa");
    expect(verifySession(secret, tampered).valid).toBe(false);
  });

  it("verifySession rejects cookies older than the max age", () => {
    const issuedAt = 1_000_000;
    const cookie = signSession(secret, issuedAt);
    const result = verifySession(secret, cookie, issuedAt + SESSION_MAX_AGE_MS + 1);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("verifySession rejects a cookie signed with a different secret", () => {
    const issuedAt = Date.now();
    const cookie = signSession("other-secret", issuedAt);
    const result = verifySession(secret, cookie, issuedAt);
    expect(result.valid).toBe(false);
  });
});
