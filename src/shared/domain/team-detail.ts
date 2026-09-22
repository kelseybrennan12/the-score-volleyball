import { compareMatches, findNextMatchDate } from "./next-match";
import type { Match, Snapshot, Team } from "./snapshot";
import { computeStandings, type StandingsRow } from "./standings";

/** A played match's result from this team's side. */
export interface TeamOutcome {
  won: boolean;
  setsFor: number;
  setsAgainst: number;
  /** `"W 2-1"` or `"L 0-3"`. */
  label: string;
}

export interface TeamMatch {
  match: Match;
  opponentNumber: number;
  /** `null` when the opponent's number is not on the roster. */
  opponent: Team | null;
  opponentRecord: StandingsRow | null;
  /** `null` until the match has been played. */
  outcome: TeamOutcome | null;
  /** True for every match on `nextDate`: a league night's games stay "next" together. */
  isNext: boolean;
}

/**
 * Team detail: a team's Record and Rank, its next match day, and its full schedule, seen from the team's own side.
 * One computation rendered by the viewer, the Calendar export, and the per-team report.
 */
export interface TeamDetail {
  /** The team's line in the Standings table (Record and Rank); `null` when the team is not on the roster. */
  standingsRow: StandingsRow | null;
  /** The team's matches in chronological order. */
  matches: TeamMatch[];
  /** The earliest match date that is today or later in the league's timezone; `null` when there is none. */
  nextDate: string | null;
}

export function buildTeamDetail(snapshot: Snapshot, team: Team, now: Date): TeamDetail {
  const { byTeam } = computeStandings(snapshot);
  const own = snapshot.matches.filter((m) => m.teamNumbers.includes(team.number)).sort(compareMatches);
  const nextDate = findNextMatchDate(own, now);
  const matches = own.map((match): TeamMatch => {
    const opponentNumber = match.teamNumbers[0] === team.number ? match.teamNumbers[1] : match.teamNumbers[0];
    return {
      match,
      opponentNumber,
      opponent: snapshot.teams.find((t) => t.number === opponentNumber) ?? null,
      opponentRecord: byTeam.get(opponentNumber) ?? null,
      outcome: outcomeFor(match, team.number),
      isNext: nextDate != null && match.date === nextDate,
    };
  });
  return { standingsRow: byTeam.get(team.number) ?? null, matches, nextDate };
}

function outcomeFor(match: Match, teamNumber: number): TeamOutcome | null {
  if (match.outcome.status !== "played") return null;
  const { winnerTeamNumber, setsWinner, setsLoser } = match.outcome;
  const won = winnerTeamNumber === teamNumber;
  const setsFor = won ? setsWinner : setsLoser;
  const setsAgainst = won ? setsLoser : setsWinner;
  return { won, setsFor, setsAgainst, label: `${won ? "W" : "L"} ${setsFor}-${setsAgainst}` };
}
