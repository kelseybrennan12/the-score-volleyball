import type { Match, Team } from "@/shared/domain/snapshot";

export interface TeamRecord {
  teamNumber: number;
  setsWon: number;
  setsLost: number;
}

export function computeRecords(teams: Team[], matches: Match[]): Map<number, TeamRecord> {
  const records = new Map<number, TeamRecord>();
  for (const team of teams) {
    records.set(team.number, { teamNumber: team.number, setsWon: 0, setsLost: 0 });
  }
  for (const match of matches) {
    if (match.outcome.status !== "played") continue;
    const { winnerTeamNumber, setsWinner, setsLoser } = match.outcome;
    const loserTeamNumber = match.teamNumbers[0] === winnerTeamNumber ? match.teamNumbers[1] : match.teamNumbers[0];
    const winnerRecord = records.get(winnerTeamNumber);
    const loserRecord = records.get(loserTeamNumber);
    if (winnerRecord) {
      winnerRecord.setsWon += setsWinner;
      winnerRecord.setsLost += setsLoser;
    }
    if (loserRecord) {
      loserRecord.setsWon += setsLoser;
      loserRecord.setsLost += setsWinner;
    }
  }
  return records;
}
