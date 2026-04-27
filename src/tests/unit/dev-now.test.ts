import { parseMockNow, readMockNowFromCookieHeader } from "@/shared/dev-now";
import { describe, expect, it } from "vitest";

describe("parseMockNow", () => {
  it("returns a Date for a valid ISO string", () => {
    const d = parseMockNow("2026-04-26T22:05:00-04:00");
    expect(d?.toISOString()).toBe("2026-04-27T02:05:00.000Z");
  });

  it("returns null for an empty value", () => {
    expect(parseMockNow("")).toBeNull();
    expect(parseMockNow(undefined)).toBeNull();
    expect(parseMockNow(null)).toBeNull();
  });

  it("returns null for junk", () => {
    expect(parseMockNow("not-a-date")).toBeNull();
    expect(parseMockNow("2026-13-99")).toBeNull();
  });
});

describe("readMockNowFromCookieHeader", () => {
  it("returns null when IS_DEV is false (NODE_ENV=test in vitest)", () => {
    expect(readMockNowFromCookieHeader("mockNow=2026-04-26T22:05:00Z")).toBeNull();
  });
});
