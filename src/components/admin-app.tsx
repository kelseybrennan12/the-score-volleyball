"use client";

import type { IngestionOutcome, LeagueOutcome } from "@/shared/domain/ingestion";
import { formatTimestamp } from "@/shared/format";
import { useCallback, useEffect, useState } from "react";
import { AnnouncementSection } from "./announcement-section";

interface ArchiveEntry {
  slug: string;
  archiveKey: string;
  ingestedAt: string;
}

interface LeagueBlock {
  slug: string;
  displayName: string;
  activeIngestedAt: string;
  archive: ArchiveEntry[];
}

interface RollbacksResponse {
  lastIngestedAt: string | null;
  leagues: LeagueBlock[];
}

/** The admin ingest route's body: the Ingestion outcome on 200, or `{ error }` (with the wait on a 429). */
type IngestResponse = IngestionOutcome | { error: string; retryAfterSeconds?: number };

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 200).trim();
    throw new Error(`Server returned HTTP ${response.status} with non-JSON response${snippet ? `: ${snippet}` : ""}.`);
  }
}

export function AdminApp() {
  const [data, setData] = useState<RollbacksResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastIngestLeagues, setLastIngestLeagues] = useState<LeagueOutcome[] | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/rollbacks", { cache: "no-store" });
      const json = await parseJsonResponse<RollbacksResponse & { error?: string }>(response);
      if (!response.ok || json.error) {
        setLoadError(json.error ?? `Failed to load admin data (HTTP ${response.status}).`);
        return;
      }
      setData(json);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load admin data.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runIngest = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ingest", { method: "POST" });
      const json = await parseJsonResponse<IngestResponse>(response);
      if ("error" in json) {
        setMessage(
          response.status === 429 && json.retryAfterSeconds
            ? `Rate-limited — try again in ${json.retryAfterSeconds}s.`
            : `Ingest failed: ${json.error || response.statusText}`,
        );
      } else if (!response.ok) {
        setMessage(`Ingest failed: ${response.statusText}`);
      } else if (json.status === "ran") {
        setLastIngestLeagues(json.leagues);
        const failed = json.leagues.filter((l) => !l.ok);
        if (failed.length === 0) {
          setMessage(`Ingested ${json.leagues.length} league${json.leagues.length === 1 ? "" : "s"}.`);
        } else {
          setMessage(
            `Ingested with ${failed.length} failure${failed.length === 1 ? "" : "s"}: ${failed.map((f) => f.slug).join(", ")}.`,
          );
        }
      }
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ingest failed.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const restore = useCallback(
    async (slug: string, archiveKey: string, ingestedAt: string) => {
      if (!window.confirm(`Restore ${slug} to snapshot from ${formatTimestamp(ingestedAt)}?`)) return;
      setBusy(true);
      setMessage(null);
      try {
        const response = await fetch("/api/admin/rollback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, archiveKey }),
        });
        const json = await parseJsonResponse<{ ok?: boolean; error?: string }>(response);
        if (!response.ok || json.error) {
          setMessage(`Rollback failed: ${json.error ?? response.statusText}`);
        } else {
          setMessage(`Restored ${slug} to ${formatTimestamp(ingestedAt)}.`);
        }
        await refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Rollback failed.");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/";
  }, []);

  return (
    <div className="space-y-6">
      <AnnouncementSection />

      <section className="rounded border border-neutral-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Ingest</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Last successful ingest: {formatTimestamp(data?.lastIngestedAt ?? null)}
            </p>
          </div>
          <button
            type="button"
            onClick={runIngest}
            disabled={busy}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Ingest now"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-neutral-700">{message}</p> : null}
        {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
        {lastIngestLeagues && lastIngestLeagues.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {lastIngestLeagues.map((league) => (
              <LeagueOutcomeRow key={league.slug} league={league} />
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Rollback</h2>
        {data?.leagues.length === 0 ? <p className="text-sm text-neutral-600">No leagues cached yet.</p> : null}
        {data?.leagues.map((league) => (
          <div key={league.slug} className="rounded border border-neutral-200 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h3 className="font-medium">{league.displayName}</h3>
                <p className="text-xs text-neutral-600">Active from {formatTimestamp(league.activeIngestedAt)}</p>
              </div>
            </div>
            {league.archive.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-600">No previous snapshots.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {league.archive.map((entry) => (
                  <li key={entry.archiveKey} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-700">{formatTimestamp(entry.ingestedAt)}</span>
                    <button
                      type="button"
                      onClick={() => void restore(entry.slug, entry.archiveKey, entry.ingestedAt)}
                      disabled={busy}
                      className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="flex justify-end">
        <button type="button" onClick={() => void signOut()} className="text-sm text-neutral-600 hover:underline">
          Sign out
        </button>
      </section>
    </div>
  );
}

function LeagueOutcomeRow({ league }: { league: LeagueOutcome }) {
  const anomalies = league.ok ? league.anomalies : [];
  const statusLabel = league.ok ? "ok" : "failed";
  const statusClass = league.ok ? (anomalies.length > 0 ? "text-amber-800" : "text-emerald-800") : "text-red-700";
  const summary = league.ok
    ? `teams=${league.teamCount} matches=${league.matchCount} rosterDiff=${league.rosterDiff}`
    : league.error;
  return (
    <li className="rounded border border-neutral-200 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{league.slug}</span>
        <span className={`text-xs uppercase tracking-wide ${statusClass}`}>{statusLabel}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-600">{summary}</p>
      {anomalies.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
          {anomalies.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      ) : league.ok ? (
        <p className="mt-2 text-xs text-neutral-500">No anomalies.</p>
      ) : null}
    </li>
  );
}
