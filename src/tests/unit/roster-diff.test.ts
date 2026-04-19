import { diffRoster } from "@/backend/logic/core/roster-diff";
import type { Team } from "@/shared/domain/snapshot";
import { describe, expect, it } from "vitest";

const baseline: Team[] = [
  { number: 1, captain: "Alice", division: "B" },
  { number: 2, captain: "Bob", division: "B" },
];

describe("diffRoster", () => {
  it("returns same when prev is null (first ingestion)", () => {
    expect(diffRoster(null, baseline)).toBe("same");
  });

  it("returns same when rosters have identical (number, captain) pairs regardless of order", () => {
    const reordered = [...baseline].reverse();
    expect(diffRoster(baseline, reordered)).toBe("same");
  });

  it("returns changed when a captain differs", () => {
    const next = [baseline[0], { ...baseline[1], captain: "Barbara" }];
    expect(diffRoster(baseline, next)).toBe("changed");
  });

  it("returns changed when team count differs", () => {
    expect(diffRoster(baseline, [baseline[0]])).toBe("changed");
  });

  it("is case-insensitive on captain", () => {
    const next = baseline.map((t) => ({ ...t, captain: t.captain.toUpperCase() }));
    expect(diffRoster(baseline, next)).toBe("same");
  });
});
