import type { Match, Snapshot, Team } from "./snapshot";

export interface TeamStats {
  teamNumber: number;
  division: string;
  setsWon: number;
  setsLost: number;
  rank: number;
  divisionSize: number;
}

export function computeTeamStats(snapshot: Snapshot): Map<number, TeamStats> {
  const records = buildRecords(snapshot.teams, snapshot.matches);
  const byDivision = groupByDivision(snapshot.teams);
  const stats = new Map<number, TeamStats>();
  for (const [division, list] of byDivision) {
    const sorted = [...list].sort((a, b) => {
      const ra = records.get(a.number)!;
      const rb = records.get(b.number)!;
      if (rb.setsWon !== ra.setsWon) return rb.setsWon - ra.setsWon;
      if (ra.setsLost !== rb.setsLost) return ra.setsLost - rb.setsLost;
      return a.number - b.number;
    });
    sorted.forEach((team, idx) => {
      const record = records.get(team.number)!;
      stats.set(team.number, {
        teamNumber: team.number,
        division,
        setsWon: record.setsWon,
        setsLost: record.setsLost,
        rank: idx + 1,
        divisionSize: sorted.length,
      });
    });
  }
  return stats;
}

function buildRecords(teams: Team[], matches: Match[]): Map<number, { setsWon: number; setsLost: number }> {
  const records = new Map<number, { setsWon: number; setsLost: number }>();
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

function groupByDivision(teams: Team[]): Map<string, Team[]> {
  const byDivision = new Map<string, Team[]>();
  for (const team of teams) {
    const list = byDivision.get(team.division) ?? [];
    list.push(team);
    byDivision.set(team.division, list);
  }
  return byDivision;
}
