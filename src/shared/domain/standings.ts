import type { Snapshot } from "./snapshot";

export interface StandingsRow {
  teamNumber: number;
  captain: string;
  division: string;
  setsWon: number;
  setsLost: number;
  rank: number | null;
  rankLabel: string;
  isTied: boolean;
}

export interface StandingsGroup {
  leagueSlug: string;
  leagueDisplayName: string;
  division: string;
  rows: StandingsRow[];
}

export interface StandingsOption {
  leagueSlug: string;
  division: string;
  label: string;
}

const DAY_LABEL: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const DAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function buildStandings(snapshot: Snapshot, division: string): StandingsGroup {
  const teamsInDivision = snapshot.teams.filter((t) => t.division === division);
  const records = new Map<number, { setsWon: number; setsLost: number }>();
  for (const team of teamsInDivision) records.set(team.number, { setsWon: 0, setsLost: 0 });
  for (const match of snapshot.matches) {
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

  const ranked: { teamNumber: number; captain: string; setsWon: number; setsLost: number }[] = [];
  const unranked: { teamNumber: number; captain: string; setsWon: number; setsLost: number }[] = [];
  for (const team of teamsInDivision) {
    const r = records.get(team.number)!;
    const entry = { teamNumber: team.number, captain: team.captain, setsWon: r.setsWon, setsLost: r.setsLost };
    if (r.setsWon === 0 && r.setsLost === 0) unranked.push(entry);
    else ranked.push(entry);
  }
  ranked.sort((a, b) => {
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    if (a.setsLost !== b.setsLost) return a.setsLost - b.setsLost;
    return a.teamNumber - b.teamNumber;
  });

  // Skip-rank with tie detection: walk sorted array; same (setsWon, setsLost) -> shared rank.
  const rows: StandingsRow[] = [];
  let i = 0;
  while (i < ranked.length) {
    let j = i + 1;
    while (j < ranked.length && ranked[j].setsWon === ranked[i].setsWon && ranked[j].setsLost === ranked[i].setsLost) {
      j++;
    }
    const rank = i + 1;
    const tied = j - i > 1;
    for (let k = i; k < j; k++) {
      const e = ranked[k];
      rows.push({
        teamNumber: e.teamNumber,
        captain: e.captain,
        division,
        setsWon: e.setsWon,
        setsLost: e.setsLost,
        rank,
        rankLabel: tied ? `T-${rank}` : String(rank),
        isTied: tied,
      });
    }
    i = j;
  }

  unranked.sort((a, b) => a.teamNumber - b.teamNumber);
  for (const e of unranked) {
    rows.push({
      teamNumber: e.teamNumber,
      captain: e.captain,
      division,
      setsWon: e.setsWon,
      setsLost: e.setsLost,
      rank: null,
      rankLabel: "—",
      isTied: false,
    });
  }

  return {
    leagueSlug: snapshot.league.slug,
    leagueDisplayName: snapshot.league.displayName,
    division,
    rows,
  };
}

export function listStandingsOptions(snapshots: Snapshot[]): StandingsOption[] {
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.league.day] ?? 99) - (DAY_ORDER[b.league.day] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.league.slug.localeCompare(b.league.slug);
  });
  const options: StandingsOption[] = [];
  for (const snapshot of sortedSnapshots) {
    const dayLabel = DAY_LABEL[snapshot.league.day] ?? snapshot.league.day;
    const divisions = new Set<string>();
    for (const t of snapshot.teams) divisions.add(t.division);
    const sortedDivisions = [...divisions].sort((a, b) => a.localeCompare(b));
    for (const division of sortedDivisions) {
      options.push({
        leagueSlug: snapshot.league.slug,
        division,
        label: `${dayLabel} ${division}`,
      });
    }
  }
  return options;
}
