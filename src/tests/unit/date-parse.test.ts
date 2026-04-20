import { parseMonthDay } from "@/backend/logic/core/date-parse";
import { describe, expect, it } from "vitest";

describe("parseMonthDay", () => {
  it("parses labels with ordinal suffixes", () => {
    expect(parseMonthDay("April 26th", 2026)).toBe("2026-04-26");
    expect(parseMonthDay("May 3rd", 2026)).toBe("2026-05-03");
    expect(parseMonthDay("June 1st", 2026)).toBe("2026-06-01");
  });

  it("parses labels without ordinal suffixes", () => {
    expect(parseMonthDay("June 29", 2025)).toBe("2025-06-29");
    expect(parseMonthDay("July 6", 2025)).toBe("2025-07-06");
  });

  it("parses months whose name contains an ordinal-looking substring (regression: August contains 'st')", () => {
    expect(parseMonthDay("August 3", 2025)).toBe("2025-08-03");
    expect(parseMonthDay("August 17", 2025)).toBe("2025-08-17");
  });

  it("parses abbreviated month names", () => {
    expect(parseMonthDay("Jul 27", 2025)).toBe("2025-07-27");
    expect(parseMonthDay("Aug. 3", 2025)).toBe("2025-08-03");
  });

  it("tolerates typo'd ordinal suffixes on the day (regression: Wednesday sheet had 'June 10h')", () => {
    expect(parseMonthDay("June 10h", 2026)).toBe("2026-06-10");
    expect(parseMonthDay("June 10st", 2026)).toBe("2026-06-10");
  });

  it("returns null for non-date strings", () => {
    expect(parseMonthDay("Playoffs", 2026)).toBeNull();
    expect(parseMonthDay("", 2026)).toBeNull();
    expect(parseMonthDay("32 v 17", 2026)).toBeNull();
  });
});
