import type { IngestionOutcome } from "@/shared/domain/ingestion";
import { timingSafeEqual } from "node:crypto";

/** Pure HTTP shaping for the two Ingestion routes: cron authorization and outcome-to-response mapping. */

export type CronAuthorization = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`; compared in constant time. */
export function authorizeCronRequest(authorization: string | null, cronSecret: string | undefined): CronAuthorization {
  if (!cronSecret) return { ok: false, status: 503, error: "CRON_SECRET not configured" };
  if (authorization == null) return { ok: false, status: 401, error: "Unauthorized" };
  const received = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const matches = received.length === expected.length && timingSafeEqual(received, expected);
  return matches ? { ok: true } : { ok: false, status: 401, error: "Unauthorized" };
}

export type AdminIngestResponse =
  | { status: 200; body: IngestionOutcome }
  | {
      status: 429;
      body: { error: string; retryAfterSeconds: number; lastIngestedAt: string };
      headers: { "Retry-After": string };
    };

/** The Admin page treats a cooldown as a refusal: 429 with the wait, so the operator sees how long to hold off. */
export function toAdminIngestResponse(outcome: IngestionOutcome): AdminIngestResponse {
  if (outcome.status === "ran") return { status: 200, body: outcome };
  const retryAfterSeconds = Math.ceil(outcome.retryAfterMs / 1000);
  return {
    status: 429,
    body: {
      error: "Ingest is rate-limited. Try again in a few minutes.",
      retryAfterSeconds,
      lastIngestedAt: outcome.lastIngestedAt,
    },
    headers: { "Retry-After": String(retryAfterSeconds) },
  };
}

/** Vercel reports any non-2xx as a cron failure, so a cooldown skip and per-league failures both answer 200. */
export function toCronIngestResponse(outcome: IngestionOutcome): { status: 200; body: IngestionOutcome } {
  return { status: 200, body: outcome };
}
