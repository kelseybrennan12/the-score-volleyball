export type LeagueDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type LeagueSession = "spring" | "summer" | "fall";
export type ScheduleVariant = "vertical" | "horizontal";

export interface League {
  slug: string;
  displayName: string;
  day: LeagueDay;
  session: LeagueSession;
  year: number;
  sourceSheetId: string;
}

export interface Team {
  number: number;
  captain: string;
  division: string;
}

export type MatchOutcome =
  | { status: "unplayed" }
  | { status: "played"; winnerTeamNumber: number; setsWinner: number; setsLoser: number };

export interface Match {
  date: string;
  time: string;
  court: string;
  teamNumbers: [number, number];
  outcome: MatchOutcome;
}

export interface Snapshot {
  schemaVersion: 1;
  league: League;
  ingestedAt: string;
  teams: Team[];
  matches: Match[];
}

export const SCHEMA_VERSION = 1 as const;
