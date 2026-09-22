import {
  authorizeCronRequest,
  toAdminIngestResponse,
  toCronIngestResponse,
} from "@/backend/logic/services/ingestion-http";
import type { IngestionOutcome } from "@/shared/domain/ingestion";
import { describe, expect, it } from "vitest";

const SECRET = "test-cron-secret";

const RAN: IngestionOutcome = {
  status: "ran",
  ranAt: "2026-05-03T17:00:00.000Z",
  dryRun: false,
  leagues: [{ slug: "spring-sundays", ok: false, error: "unreachable" }],
};

const SKIPPED: IngestionOutcome = {
  status: "skipped",
  reason: "cooldown",
  lastIngestedAt: "2026-05-03T16:58:00.000Z",
  retryAfterMs: 179_001,
};

describe("authorizeCronRequest", () => {
  it("accepts the configured bearer token", () => {
    expect(authorizeCronRequest(`Bearer ${SECRET}`, SECRET)).toEqual({ ok: true });
  });

  it("answers 503 when CRON_SECRET is not configured, whatever the header", () => {
    expect(authorizeCronRequest(`Bearer ${SECRET}`, undefined)).toEqual({
      ok: false,
      status: 503,
      error: "CRON_SECRET not configured",
    });
  });

  it.each([
    ["a missing header", null],
    ["the wrong scheme", `Token ${SECRET}`],
    ["the wrong secret", "Bearer not-the-secret"],
  ])("answers 401 for %s", (_, header) => {
    expect(authorizeCronRequest(header, SECRET)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("answers 401, not a crash, for a header of the right length in characters but not in bytes", () => {
    const sameLengthNonAscii = `Bearer ${"é".repeat(SECRET.length)}`;
    expect(sameLengthNonAscii.length).toBe(`Bearer ${SECRET}`.length);
    expect(authorizeCronRequest(sameLengthNonAscii, SECRET)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });
});

describe("toAdminIngestResponse", () => {
  it("returns a run as a 200 with the outcome as the body, failed leagues included", () => {
    expect(toAdminIngestResponse(RAN)).toEqual({ status: 200, body: RAN });
  });

  it("refuses a run skipped for cooldown with 429 and the wait rounded up to whole seconds", () => {
    expect(toAdminIngestResponse(SKIPPED)).toEqual({
      status: 429,
      body: {
        error: "Ingest is rate-limited. Try again in a few minutes.",
        retryAfterSeconds: 180,
        lastIngestedAt: "2026-05-03T16:58:00.000Z",
      },
      headers: { "Retry-After": "180" },
    });
  });
});

describe("toCronIngestResponse", () => {
  it("answers 200 for a skipped run, so a cooldown collision does not read as a failed cron", () => {
    expect(toCronIngestResponse(SKIPPED)).toEqual({ status: 200, body: SKIPPED });
  });

  it("answers 200 for a run with failed leagues; the failures stay in the body", () => {
    expect(toCronIngestResponse(RAN)).toEqual({ status: 200, body: RAN });
  });
});
