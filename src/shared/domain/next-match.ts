import type { Match } from "./snapshot";

export const LEAGUE_TIMEZONE = "America/Detroit";

export function findNextMatch(matches: Match[], now: Date = new Date()): Match | null {
  const todayIso = isoDateInTimezone(now, LEAGUE_TIMEZONE);
  const eligible = matches.filter((m) => m.date >= todayIso);
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareMatches)[0];
}

export function compareMatches(a: Match, b: Match): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.court.localeCompare(b.court);
}

export function todayIsoInLeagueTimezone(now: Date = new Date()): string {
  return isoDateInTimezone(now, LEAGUE_TIMEZONE);
}

function isoDateInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
