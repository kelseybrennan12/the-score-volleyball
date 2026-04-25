import type { Team } from "@/shared/domain/snapshot";
import type { TeamRecord } from "./record";

export interface TeamRank {
  teamNumber: number;
  division: string;
  rank: number | null;
  divisionSize: number;
}

export function computeRanks(teams: Team[], records: Map<number, TeamRecord>): Map<number, TeamRank> {
  const byDivision = new Map<string, Team[]>();
  for (const team of teams) {
    const list = byDivision.get(team.division) ?? [];
    list.push(team);
    byDivision.set(team.division, list);
  }
  const ranks = new Map<number, TeamRank>();
  for (const [division, list] of byDivision) {
    const ranked: Team[] = [];
    const unranked: Team[] = [];
    for (const team of list) {
      const record = records.get(team.number) ?? { setsWon: 0, setsLost: 0, teamNumber: team.number };
      if (record.setsWon === 0 && record.setsLost === 0) unranked.push(team);
      else ranked.push(team);
    }
    ranked.sort((a, b) => {
      const ra = records.get(a.number) ?? { setsWon: 0, setsLost: 0, teamNumber: a.number };
      const rb = records.get(b.number) ?? { setsWon: 0, setsLost: 0, teamNumber: b.number };
      if (rb.setsWon !== ra.setsWon) return rb.setsWon - ra.setsWon;
      if (ra.setsLost !== rb.setsLost) return ra.setsLost - rb.setsLost;
      return a.number - b.number;
    });
    ranked.forEach((team, idx) => {
      ranks.set(team.number, {
        teamNumber: team.number,
        division,
        rank: idx + 1,
        divisionSize: list.length,
      });
    });
    for (const team of unranked) {
      ranks.set(team.number, {
        teamNumber: team.number,
        division,
        rank: null,
        divisionSize: list.length,
      });
    }
  }
  return ranks;
}
