"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "volleyball-viewer:dismissed-announcement";

export function AnnouncementBanner({ message, version }: { message: string; version: number }) {
  const [visible, setVisible] = useState(false);
  const dismissalId = String(version);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== dismissalId);
    } catch {
      setVisible(true);
    }
  }, [dismissalId]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, dismissalId);
    } catch {
      // Ignore storage errors (e.g. quota, private mode); the banner just reappears next visit.
    }
  };

  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-4 text-teal-900"
    >
      <span aria-hidden className="text-2xl">
        🏐
      </span>
      <p className="flex-1 text-lg font-semibold sm:text-xl">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="-mr-1 shrink-0 rounded p-1 text-2xl leading-none text-teal-700 hover:bg-teal-100 hover:text-teal-900"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}
