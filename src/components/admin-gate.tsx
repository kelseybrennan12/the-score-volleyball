"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const TAP_WINDOW_MS = 600;
const TAP_COUNT = 3;

export function AdminGate({ children }: { children: ReactNode }) {
  const tapTimesRef = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLSpanElement>) => {
    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t < TAP_WINDOW_MS);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= TAP_COUNT) {
      event.preventDefault();
      tapTimesRef.current = [];
      setOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPassphrase("");
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const submit = useCallback(async () => {
    if (!passphrase) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) {
        if (response.status === 503) {
          setError("Admin tool is not configured.");
        } else {
          const json = (await response.json().catch(() => ({}))) as { error?: string };
          setError(json.error ?? "Incorrect passphrase.");
        }
        setSubmitting(false);
        return;
      }
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }, [passphrase]);

  return (
    <>
      <span onPointerUp={handlePointerUp} style={{ touchAction: "manipulation" }}>
        {children}
      </span>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium">Admin</h2>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                type="password"
                autoFocus
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                disabled={submitting}
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded px-3 py-2 text-sm text-neutral-600"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !passphrase}
                  className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Checking…" : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
