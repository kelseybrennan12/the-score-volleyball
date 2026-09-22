import { formatDay } from "../format";
import type { Match, Snapshot, Team } from "./snapshot";

/** One team's Record and Rank within its division. */
export interface StandingsRow {
  teamNumber: number;
  captain: string;
  division: string;
  setsWon: number;
  setsLost: number;
  /** Shared by tied teams (skip-rank); `null` for a team that has not played a set. */
  rank: number | null;
  /** `"1"`, `"T-2"`, or `"—"` for an unranked team. */
  rankLabel: string;
  isTied: boolean;
  /** Teams in the division, ranked or not. */
  divisionSize: number;
}

export interface StandingsGroup {
  leagueSlug: string;
  leagueDisplayName: string;
  division: string;
  rows: StandingsRow[];
}

/**
 * Record and Rank for every team in a snapshot: the per-division tables, and the same rows indexed by team number for
 * Team detail (a team's own line and each opponent's record).
 */
export interface Standings {
  /** One group per division, divisions sorted alphabetically, rows in rank order. */
  divisions: StandingsGroup[];
  byDivision: Map<string, StandingsGroup>;
  byTeam: Map<number, StandingsRow>;
}

export interface StandingsOption {
  leagueSlug: string;
  division: string;
  label: string;
}

const DAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Compute Record and Rank for every team in the snapshot. Record counts every played match (teams only play within
 * their division). Rank orders a division by sets won descending, then sets lost ascending; teams sharing a record
 * share a rank (skip-rank, labeled T-N); teams that have not played a set are unranked at the bottom, by team number.
 */
export function computeStandings(snapshot: Snapshot): Standings {
  const records = computeRecords(snapshot.teams, snapshot.matches);
  const byDivision = groupByDivision(snapshot.teams);
  const divisions: StandingsGroup[] = [];
  const groups = new Map<string, StandingsGroup>();
  const byTeam = new Map<number, StandingsRow>();
  for (const [division, teams] of byDivision) {
    const rows = rankDivision(division, teams, records);
    for (const row of rows) byTeam.set(row.teamNumber, row);
    const group = { leagueSlug: snapshot.league.slug, leagueDisplayName: snapshot.league.displayName, division, rows };
    divisions.push(group);
    groups.set(division, group);
  }
  return { divisions, byDivision: groups, byTeam };
}

export function listStandingsOptions(snapshots: Snapshot[]): StandingsOption[] {
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.league.day] ?? 99) - (DAY_ORDER[b.league.day] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.league.slug.localeCompare(b.league.slug);
  });
  const options: StandingsOption[] = [];
  for (const snapshot of sortedSnapshots) {
    for (const division of groupByDivision(snapshot.teams).keys()) {
      options.push({
        leagueSlug: snapshot.league.slug,
        division,
        label: `${formatDay(snapshot.league.day)} ${division}`,
      });
    }
  }
  return options;
}

interface SetRecord {
  setsWon: number;
  setsLost: number;
}

function computeRecords(teams: Team[], matches: Match[]): Map<number, SetRecord> {
  const records = new Map<number, SetRecord>();
  for (const team of teams) records.set(team.number, { setsWon: 0, setsLost: 0 });
  for (const match of matches) {
    if (match.outcome.status !== "played") continue;
    const { winnerTeamNumber, setsWinner, setsLoser } = match.outcome;
    const loserTeamNumber = match.teamNumbers[0] === winnerTeamNumber ? match.teamNumbers[1] : match.teamNumbers[0];
    const winner = records.get(winnerTeamNumber);
    const loser = records.get(loserTeamNumber);
    if (winner) {
      winner.setsWon += setsWinner;
      winner.setsLost += setsLoser;
    }
    if (loser) {
      loser.setsWon += setsLoser;
      loser.setsLost += setsWinner;
    }
  }
  return records;
}

/** Divisions in alphabetical order, teams in input order. */
function groupByDivision(teams: Team[]): Map<string, Team[]> {
  const byDivision = new Map<string, Team[]>();
  for (const team of teams) {
    const list = byDivision.get(team.division) ?? [];
    list.push(team);
    byDivision.set(team.division, list);
  }
  return new Map([...byDivision.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

interface Entry {
  team: Team;
  record: SetRecord;
}

function rankDivision(division: string, teams: Team[], records: Map<number, SetRecord>): StandingsRow[] {
  const divisionSize = teams.length;
  const entries: Entry[] = teams.map((team) => ({ team, record: records.get(team.number)! }));
  const ranked = entries.filter((e) => e.record.setsWon > 0 || e.record.setsLost > 0);
  const unranked = entries.filter((e) => e.record.setsWon === 0 && e.record.setsLost === 0);
  ranked.sort((a, b) => {
    if (b.record.setsWon !== a.record.setsWon) return b.record.setsWon - a.record.setsWon;
    if (a.record.setsLost !== b.record.setsLost) return a.record.setsLost - b.record.setsLost;
    return a.team.number - b.team.number;
  });
  unranked.sort((a, b) => a.team.number - b.team.number);

  const toRow = (e: Entry, rank: number | null, tied: boolean): StandingsRow => ({
    teamNumber: e.team.number,
    captain: e.team.captain,
    division,
    setsWon: e.record.setsWon,
    setsLost: e.record.setsLost,
    rank,
    rankLabel: rank == null ? "—" : tied ? `T-${rank}` : String(rank),
    isTied: tied,
    divisionSize,
  });

  const rows: StandingsRow[] = [];
  // Skip-rank with tie detection: walk the sorted list; the same (setsWon, setsLost) shares a rank.
  let i = 0;
  while (i < ranked.length) {
    const ri = ranked[i].record;
    let j = i + 1;
    while (j < ranked.length && ranked[j].record.setsWon === ri.setsWon && ranked[j].record.setsLost === ri.setsLost) {
      j++;
    }
    const tied = j - i > 1;
    for (let k = i; k < j; k++) rows.push(toRow(ranked[k], i + 1, tied));
    i = j;
  }
  for (const e of unranked) rows.push(toRow(e, null, false));
  return rows;
}
