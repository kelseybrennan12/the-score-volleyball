import type { MatchOutcome } from "@/shared/domain/snapshot";

export const COLOR_MAGENTA_3_0 = "FFFF00FF";
export const COLOR_BLUE_2_1 = "FF4A86E8";

export interface MatchupCell {
  teamNumbers: [number, number];
  fillArgb: string | null;
}

export function deriveOutcome(cell: MatchupCell): { outcome: MatchOutcome; anomaly: string | null } {
  const color = cell.fillArgb?.toUpperCase() ?? null;
  if (color === COLOR_MAGENTA_3_0) {
    return {
      outcome: { status: "played", winnerTeamNumber: cell.teamNumbers[0], setsWinner: 3, setsLoser: 0 },
      anomaly: null,
    };
  }
  if (color === COLOR_BLUE_2_1) {
    return {
      outcome: { status: "played", winnerTeamNumber: cell.teamNumbers[0], setsWinner: 2, setsLoser: 1 },
      anomaly: null,
    };
  }
  return { outcome: { status: "unplayed" }, anomaly: null };
}
