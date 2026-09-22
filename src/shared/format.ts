/** Display formatting shared by the viewer, the Admin page, and the per-team report. */

/** `"18:05"` → `"6:05pm"`. A value that is not `HH:mm` is returned as given. */
export function formatTime(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const h = Number(match[1]);
  const m = match[2];
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m}${suffix}`;
}

/** `"sunday"` → `"Sunday"`. */
export function formatDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** `"2026-04-26"` → `"Sun, Apr 26"`. The date is a calendar day, so no timezone shifts it; not `YYYY-MM-DD` → as given. */
export function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map((p) => Number.parseInt(p, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

/**
 * `"2026-04-19T18:05:30Z"` → `"Apr 19, 2026, 2:05 PM"` in the runtime's local timezone (the viewer shows snapshot
 * times in the visitor's own zone). `null` reads `"never"`; a value that does not parse is returned as given.
 * `timeZone` is for deterministic tests.
 */
export function formatTimestamp(iso: string | null, timeZone?: string): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
