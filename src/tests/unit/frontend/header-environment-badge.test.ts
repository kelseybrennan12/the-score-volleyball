import { resolveEnvironmentBadgeLabel } from "@frontend/layout/Header";
import { describe, expect, it } from "vitest";

describe("resolveEnvironmentBadgeLabel", () => {
  it("returns Local for the local deployment environment", () => {
    expect(resolveEnvironmentBadgeLabel("local")).toBe("Local");
  });

  it("returns Staging for the staging deployment environment", () => {
    expect(resolveEnvironmentBadgeLabel("staging")).toBe("Staging");
  });

  it("returns no badge for production or unknown state", () => {
    expect(resolveEnvironmentBadgeLabel("prod")).toBeNull();
    expect(resolveEnvironmentBadgeLabel(null)).toBeNull();
  });
});
