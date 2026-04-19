import type { LeagueDay, LeagueSession } from "@/shared/domain/snapshot";

export interface LeagueSource {
  slug: string;
  displayName: string;
  session: LeagueSession;
  year: number;
  day: LeagueDay;
  sheetId: string;
  defaultDivision?: string;
}

// Only the currently-active Spring 2026 leagues are ingested.
// Summer/Fall sheets from thescoregr.com still reflect the 2025 season and
// will be added back here once the new season rosters are published.
export const LEAGUE_SOURCES: LeagueSource[] = [
  {
    slug: "spring-sundays",
    displayName: "Spring Sundays",
    session: "spring",
    year: 2026,
    day: "sunday",
    sheetId: "1WEAya6DXP78Md-FxvfE-Ripk0lo_BWjNY9TY4Tw31v4",
  },
  {
    slug: "spring-mondays",
    displayName: "Spring Mondays",
    session: "spring",
    year: 2026,
    day: "monday",
    sheetId: "1-b3l_bT4VfFTaRasioutpiPpMIgLPSsrE87Q6FMc21s",
    defaultDivision: "B",
  },
  {
    slug: "spring-tuesdays",
    displayName: "Spring Tuesdays",
    session: "spring",
    year: 2026,
    day: "tuesday",
    sheetId: "1OfvadnwNQP6T0JbqzGIsfhs9YzhhdnQ6ML1qfPDb2cc",
    defaultDivision: "A",
  },
  {
    slug: "spring-wednesdays",
    displayName: "Spring Wednesdays",
    session: "spring",
    year: 2026,
    day: "wednesday",
    sheetId: "113J5ABuqmLAFXSxx5lqEMlm_HLubou-TWjooJb8uQq8",
    defaultDivision: "BB",
  },
  {
    slug: "spring-thursdays",
    displayName: "Spring Thursdays",
    session: "spring",
    year: 2026,
    day: "thursday",
    sheetId: "1cX-8Z74pt4cRJNWuMYtHKplyPDxYJWsSXtAZcMvVfk8",
    defaultDivision: "A",
  },
  {
    slug: "spring-fridays",
    displayName: "Spring Fridays",
    session: "spring",
    year: 2026,
    day: "friday",
    sheetId: "1pmv7GfGvJk_lOkUWEX2Jiyf4T3T8qyNdRu-TKxRXOQ8",
    defaultDivision: "B",
  },
];
