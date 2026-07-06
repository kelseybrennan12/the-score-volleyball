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

// Only the currently-active Summer 2026 leagues are ingested. Spring 2026 has been frozen into the
// previous-seasons archive (see docs/specs/technical/snapshot-storage.md); its sheets are no longer polled.
// Sheet IDs sourced from https://www.thescoregr.com/volleyball/beach-volleyball-leagues/.
export const LEAGUE_SOURCES: LeagueSource[] = [
  {
    slug: "summer-sundays",
    displayName: "Summer Sundays",
    session: "summer",
    year: 2026,
    day: "sunday",
    sheetId: "1IL4qeqYisQ4SHbbl_rmh05CqAYFJjKh5ZleRVTcOOw0",
  },
  {
    slug: "summer-mondays",
    displayName: "Summer Mondays",
    session: "summer",
    year: 2026,
    day: "monday",
    sheetId: "14C1Y-viYvpRpBOu90Hw-hJZhWBcCnOnFPKYdbNUE4TU",
    defaultDivision: "B",
  },
  {
    slug: "summer-tuesdays",
    displayName: "Summer Tuesdays",
    session: "summer",
    year: 2026,
    day: "tuesday",
    sheetId: "1x_gDvpqjBgsudqfKugo524xEOKdq2WDRQnctYfezRPg",
    defaultDivision: "A",
  },
  {
    slug: "summer-wednesdays",
    displayName: "Summer Wednesdays",
    session: "summer",
    year: 2026,
    day: "wednesday",
    sheetId: "1mKil0nE9rx1NIhzKAC0eTgEOm48PHdgteZ6UmIymeEM",
    defaultDivision: "BB",
  },
  {
    slug: "summer-thursdays",
    displayName: "Summer Thursdays",
    session: "summer",
    year: 2026,
    day: "thursday",
    sheetId: "1VO0KAPeyxRNzvoqconBpQXgMWTfYwLkdq_3eih6bJCk",
    defaultDivision: "A",
  },
  {
    slug: "summer-fridays",
    displayName: "Summer Fridays",
    session: "summer",
    year: 2026,
    day: "friday",
    sheetId: "1Hsjl4hB3ca5XrpYPWNJy4MBdXDzeKJG9_LXpm4yf5J8",
    defaultDivision: "B",
  },
];
