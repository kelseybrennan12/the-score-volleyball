import { formatDate, formatDay, formatTime, formatTimestamp } from "@/shared/format";
import { describe, expect, it } from "vitest";

describe("formatTime", () => {
  it("renders a 24-hour HH:mm as a compact 12-hour time", () => {
    expect(formatTime("18:05")).toBe("6:05pm");
    expect(formatTime("09:30")).toBe("9:30am");
  });

  it("treats midnight and noon as 12", () => {
    expect(formatTime("00:00")).toBe("12:00am");
    expect(formatTime("12:00")).toBe("12:00pm");
  });

  it("returns an unparseable value as given", () => {
    expect(formatTime("TBD")).toBe("TBD");
  });
});

describe("formatDate", () => {
  it("renders an ISO calendar date with its weekday, independent of the runtime timezone", () => {
    expect(formatDate("2026-04-26")).toBe("Sun, Apr 26");
    expect(formatDate("2026-12-31")).toBe("Thu, Dec 31");
  });

  it("returns a value that is not a calendar date as given", () => {
    expect(formatDate("TBD")).toBe("TBD");
  });
});

describe("formatTimestamp", () => {
  it("renders an instant as a short en-US date and time in the given zone", () => {
    expect(formatTimestamp("2026-04-19T18:05:30Z", "America/Detroit")).toBe("Apr 19, 2026, 2:05 PM");
  });

  it("reads a missing timestamp as never", () => {
    expect(formatTimestamp(null)).toBe("never");
  });

  it("returns an unparseable timestamp as given", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});

describe("formatDay", () => {
  it("renders a league day as its capitalized weekday name", () => {
    expect(formatDay("sunday")).toBe("Sunday");
    expect(formatDay("wednesday")).toBe("Wednesday");
  });
});
