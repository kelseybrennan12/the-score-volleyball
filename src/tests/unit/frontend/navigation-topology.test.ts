import { HEADER_NAV_ITEMS } from "@frontend/features/parity/navigation-topology";
import { describe, expect, test } from "vitest";

describe("starter header navigation", () => {
  test("keeps the starter route set visible in the header", () => {
    expect(HEADER_NAV_ITEMS).toEqual([
      { label: "Dashboard", to: "/dashboard" },
      { label: "Database", to: "/database" },
      { label: "Jobs", to: "/jobs" },
      { label: "Settings", to: "/settings" },
    ]);
  });
});
