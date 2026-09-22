"use client";

import { ANNOUNCEMENT_MAX_LENGTH, type Announcement } from "@/shared/domain/announcement";
import { formatTimestamp } from "@/shared/format";
import { useCallback, useEffect, useState } from "react";

interface SaveErrorBody {
  error?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 200).trim();
    throw new Error(`Server returned HTTP ${response.status} with non-JSON response${snippet ? `: ${snippet}` : ""}.`);
  }
}

// The read view when nothing is stored yet: off, blank, version 0.
const EMPTY: Announcement = { message: "", enabled: false, version: 0, updatedAt: "" };

function statusLine(loaded: boolean, view: Announcement): string {
  if (!loaded) return "Loading…";
  if (view.enabled) return `Live — last saved ${formatTimestamp(view.updatedAt || null)}`;
  if (view.updatedAt) return `Off — last saved ${formatTimestamp(view.updatedAt)}`;
  return "Off — nothing published yet";
}

function BannerReadView({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-4 text-teal-900"
    >
      <span aria-hidden className="text-2xl">
        🏐
      </span>
      <p className="flex-1 text-lg font-semibold sm:text-xl">
        {message || <span className="italic opacity-50">No message yet.</span>}
      </p>
      <span aria-hidden className="-mr-1 shrink-0 rounded p-1 text-2xl leading-none text-teal-700">
        ×
      </span>
    </div>
  );
}

export function AnnouncementSection() {
  const [stored, setStored] = useState<Announcement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const view = stored ?? EMPTY;

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/announcement", { cache: "no-store" });
      const json = await parseJson<{ announcement: Announcement | null } & SaveErrorBody>(response);
      if (!response.ok || json.error) {
        setError(json.error ?? `Failed to load the announcement (HTTP ${response.status}).`);
        return;
      }
      setStored(json.announcement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the announcement.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (message: string, enabled: boolean, publishAsNew: boolean): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, enabled, publishAsNew }),
      });
      const json = await parseJson<Announcement & SaveErrorBody>(response);
      if (!response.ok || json.error) {
        setError(json.error ?? `Save failed (HTTP ${response.status}).`);
        return false;
      }
      setStored(json);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    // Turning the switch on is a save; refuse when the stored message is blank.
    if (!view.enabled && view.message.trim().length === 0) {
      setError("Add a message before turning the announcement on.");
      return;
    }
    await save(view.message, !view.enabled, false);
  }, [view.enabled, view.message, save]);

  const startEdit = useCallback(() => {
    setDraft(view.message);
    setError(null);
    setEditing(true);
  }, [view.message]);

  const cancelEdit = useCallback(() => {
    setDraft(view.message);
    setEditing(false);
    setError(null);
  }, [view.message]);

  const commit = useCallback(
    async (publishAsNew: boolean) => {
      const ok = await save(draft.trim(), view.enabled, publishAsNew);
      if (ok) setEditing(false);
    },
    [draft, view.enabled, save],
  );

  const draftBlank = draft.trim().length === 0;

  return (
    <section className="rounded border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Announcement</h2>
          <p className="mt-1 text-sm text-neutral-600">{statusLine(loaded, view)}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={view.enabled}
          aria-label={view.enabled ? "Turn announcement off" : "Turn announcement on"}
          disabled={busy || !loaded}
          onClick={() => void toggle()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            view.enabled ? "bg-teal-600" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              view.enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, ANNOUNCEMENT_MAX_LENGTH))}
              rows={2}
              autoFocus
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-neutral-500">
                {draft.length}/{ANNOUNCEMENT_MAX_LENGTH}
              </span>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                className="rounded px-3 py-2 text-sm text-neutral-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || draftBlank}
                onClick={() => void commit(false)}
                title="Keeps existing dismissals. Use for typo fixes."
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
              >
                Save edits
              </button>
              <button
                type="button"
                disabled={busy || draftBlank}
                onClick={() => void commit(true)}
                title="Everyone sees it again, including people who dismissed the old one."
                className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Publish as new
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <BannerReadView message={view.message} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={startEdit}
                disabled={!loaded}
                className="text-sm text-neutral-600 hover:underline disabled:opacity-50"
              >
                Edit message
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
