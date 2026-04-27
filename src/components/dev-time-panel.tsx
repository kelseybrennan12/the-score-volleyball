"use client";

import { IS_DEV, MOCK_NOW_COOKIE } from "@/shared/dev-now";
import { LEAGUE_TIMEZONE } from "@/shared/domain/next-match";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DevTimePanel({ mockNowIso }: { mockNowIso: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(mockNowIso ? toLocalDateTimeInputValue(new Date(mockNowIso)) : toLocalDateTimeInputValue(new Date()));
  }, [mockNowIso]);

  if (!IS_DEV) return null;

  const apply = () => {
    if (!draft) return;
    const parsed = new Date(draft);
    if (Number.isNaN(parsed.getTime())) return;
    document.cookie = `${MOCK_NOW_COOKIE}=${encodeURIComponent(parsed.toISOString())}; path=/; SameSite=Lax`;
    router.refresh();
  };

  const clear = () => {
    document.cookie = `${MOCK_NOW_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
    router.refresh();
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      <summary className="cursor-pointer font-semibold">
        Dev: mock time {mockNowIso && <span className="ml-1 font-normal">(active)</span>}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-neutral-800"
        />
        <button
          type="button"
          onClick={apply}
          className="rounded-md border border-amber-400 bg-amber-200 px-2 py-1 text-xs font-medium hover:bg-amber-300"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!mockNowIso}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
        <span className="text-[10px] text-amber-800">{LEAGUE_TIMEZONE}</span>
      </div>
    </details>
  );
}

function toLocalDateTimeInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
