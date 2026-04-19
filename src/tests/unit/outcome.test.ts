import { COLOR_BLUE_2_1, COLOR_MAGENTA_3_0, deriveOutcome } from "@/backend/logic/core/outcome";
import { describe, expect, it } from "vitest";

describe("deriveOutcome", () => {
  it("maps magenta to a 3-0 win for the first-listed team", () => {
    const result = deriveOutcome({ teamNumbers: [7, 3], fillArgb: COLOR_MAGENTA_3_0 });
    expect(result.outcome).toEqual({ status: "played", winnerTeamNumber: 7, setsWinner: 3, setsLoser: 0 });
  });

  it("maps blue to a 2-1 win for the first-listed team", () => {
    const result = deriveOutcome({ teamNumbers: [3, 7], fillArgb: COLOR_BLUE_2_1 });
    expect(result.outcome).toEqual({ status: "played", winnerTeamNumber: 3, setsWinner: 2, setsLoser: 1 });
  });

  it("treats default/null fill as unplayed", () => {
    expect(deriveOutcome({ teamNumbers: [1, 2], fillArgb: null }).outcome).toEqual({ status: "unplayed" });
    expect(deriveOutcome({ teamNumbers: [1, 2], fillArgb: "FFFFFFFF" }).outcome).toEqual({ status: "unplayed" });
  });

  it("treats unrecognized fill colors as unplayed", () => {
    expect(deriveOutcome({ teamNumbers: [1, 2], fillArgb: "FFFFFF00" }).outcome).toEqual({ status: "unplayed" });
  });
});
