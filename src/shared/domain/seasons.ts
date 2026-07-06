import type { LeagueSession, Snapshot } from "./snapshot";

/**
 * A frozen past season: one immutable snapshot per league, surfaced read-only in the Standings tab's
 * "Previous Seasons" section. Distinct from the live `active` set and from rollback `archive` history.
 */
export interface SeasonArchive {
  key: string;
  session: LeagueSession;
  year: number;
  label: string;
  snapshots: Snapshot[];
}

// Later sessions sort ahead of earlier ones within the same year (newest-first).
const SESSION_ORDER: Record<LeagueSession, number> = {
  spring: 0,
  summer: 1,
  fall: 2,
};

export function seasonKeyFor(session: LeagueSession, year: number): string {
  return `${session}-${year}`;
}

export function seasonLabel(session: LeagueSession, year: number): string {
  return `${session.charAt(0).toUpperCase()}${session.slice(1)} ${year}`;
}

/**
 * Group snapshots (keyed by season key, e.g. `spring-2026`) into labeled `SeasonArchive` entries,
 * sorted newest-first (year descending, then session descending within a year). Season identity is
 * derived from each group's first snapshot; groups keyed by directory are internally uniform.
 */
export function buildSeasonArchives(byKey: Map<string, Snapshot[]>): SeasonArchive[] {
  const archives: SeasonArchive[] = [];
  for (const [key, snapshots] of byKey) {
    if (snapshots.length === 0) continue;
    const { session, year } = snapshots[0].league;
    archives.push({ key, session, year, label: seasonLabel(session, year), snapshots });
  }
  archives.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return (SESSION_ORDER[b.session] ?? 0) - (SESSION_ORDER[a.session] ?? 0);
  });
  return archives;
}
