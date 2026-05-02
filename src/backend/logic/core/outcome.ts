import type { MatchOutcome } from "@/shared/domain/snapshot";

export const COLOR_MAGENTA_3_0 = "FFFF00FF";
// Legend cell uses FF4A86E8, but captains fill match cells with the lighter
// FFA4C2F4. Accept both so either color marks a 2-1 outcome.
export const COLOR_BLUE_2_1 = "FFA4C2F4";
export const COLOR_BLUE_2_1_LEGEND = "FF4A86E8";

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
  if (color === COLOR_BLUE_2_1 || color === COLOR_BLUE_2_1_LEGEND) {
    return {
      outcome: { status: "played", winnerTeamNumber: cell.teamNumbers[0], setsWinner: 2, setsLoser: 1 },
      anomaly: null,
    };
  }
  return { outcome: { status: "unplayed" }, anomaly: null };
}
