import { LEAGUE_TIMEZONE, todayIsoInLeagueTimezone } from "./next-match";
import type { LeagueDay, Match, Snapshot } from "./snapshot";

export const NOW_WINDOW_MINUTES = 50;

const DAY_NAME_TO_LEAGUE_DAY: Record<string, LeagueDay> = {
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
};

export interface NowMatch {
  match: Match;
  snapshot: Snapshot;
}

export interface NowViewSelection {
  groupsByCourt: Map<string, NowMatch[]>;
  upcomingByCourt: Map<string, NowMatch[]>;
  nextUpcomingTime: string | null;
  anyLeagueToday: boolean;
  todayIso: string;
  currentHHmm: string;
  todayWeekday: LeagueDay | null;
}

export function dayOfWeekInLeagueTimezone(now: Date = new Date()): LeagueDay | null {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TIMEZONE,
    weekday: "long",
  })
    .format(now)
    .toLowerCase();
  return DAY_NAME_TO_LEAGUE_DAY[weekday] ?? null;
}

export function currentHHmmInLeagueTimezone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LEAGUE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const normalizedHour = hour === "24" ? "00" : hour;
  return `${normalizedHour}:${minute}`;
}

export function selectNowMatches(
  snapshots: Snapshot[],
  now: Date = new Date(),
  windowMinutes: number = NOW_WINDOW_MINUTES,
): NowViewSelection {
  const todayWeekday = dayOfWeekInLeagueTimezone(now);
  const todayIso = todayIsoInLeagueTimezone(now);
  const currentHHmm = currentHHmmInLeagueTimezone(now);
  const currentMinutes = hhmmToMinutes(currentHHmm) ?? 0;

  const todaySnapshots = todayWeekday ? snapshots.filter((s) => s.league.day === todayWeekday) : [];
  const anyLeagueToday = todaySnapshots.length > 0;

  const groupsByCourt = new Map<string, NowMatch[]>();
  const futureMatches: NowMatch[] = [];
  let nextUpcomingTime: string | null = null;

  for (const snapshot of todaySnapshots) {
    for (const match of snapshot.matches) {
      if (match.date !== todayIso) continue;
      const matchMinutes = hhmmToMinutes(match.time);
      if (matchMinutes == null) continue;
      const elapsed = currentMinutes - matchMinutes;
      if (elapsed >= 0 && elapsed < windowMinutes) {
        const list = groupsByCourt.get(match.court) ?? [];
        list.push({ match, snapshot });
        groupsByCourt.set(match.court, list);
      } else if (matchMinutes > currentMinutes) {
        futureMatches.push({ match, snapshot });
        if (nextUpcomingTime == null || match.time < nextUpcomingTime) {
          nextUpcomingTime = match.time;
        }
      }
    }
  }

  for (const [court, list] of groupsByCourt) {
    list.sort((a, b) => a.match.time.localeCompare(b.match.time));
    groupsByCourt.set(court, list);
  }

  const upcomingByCourt = new Map<string, NowMatch[]>();
  if (nextUpcomingTime != null) {
    for (const entry of futureMatches) {
      if (entry.match.time !== nextUpcomingTime) continue;
      const list = upcomingByCourt.get(entry.match.court) ?? [];
      list.push(entry);
      upcomingByCourt.set(entry.match.court, list);
    }
  }

  return {
    groupsByCourt,
    upcomingByCourt,
    nextUpcomingTime,
    anyLeagueToday,
    todayIso,
    currentHHmm,
    todayWeekday,
  };
}

function hhmmToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}
