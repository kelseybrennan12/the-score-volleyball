import type { LeagueDay, Snapshot } from "./snapshot";

export const DAYS: readonly LeagueDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const;

export interface RawSelection {
  day: string | null;
  league: string | null;
  team: number | null;
}

export interface ValidatedSelection {
  day: LeagueDay | null;
  league: string | null;
  team: number | null;
}

export function isLeagueDay(value: string | null): value is LeagueDay {
  return value != null && (DAYS as readonly string[]).includes(value);
}

export function validateUrlSelection(snapshots: Snapshot[], raw: RawSelection): ValidatedSelection {
  const day = isLeagueDay(raw.day) ? raw.day : null;

  if (day == null) {
    return { day: null, league: null, team: null };
  }

  const daySnapshots = snapshots.filter((s) => s.league.day === day);
  const league = raw.league != null && daySnapshots.some((s) => s.league.slug === raw.league) ? raw.league : null;

  if (league == null) {
    return { day, league: null, team: null };
  }

  const snapshot = daySnapshots.find((s) => s.league.slug === league) ?? null;
  const team = raw.team != null && snapshot?.teams.some((t) => t.number === raw.team) ? raw.team : null;

  return { day, league, team };
}
