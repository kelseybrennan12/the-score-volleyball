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

// Only the currently-active Fall 2026 leagues are ingested. Earlier 2026 seasons are frozen into the
// previous-seasons archive (see docs/specs/technical/snapshot-storage.md); their sheets are no longer polled.
// Sheet IDs sourced from https://www.thescoregr.com/volleyball/beach-volleyball-leagues/.
// Fall Thursday (Women's QOTB 1Gv4HZJ40yDiebUFMf0ODtmupkzb4x0T2ZVo_zR9OCyc) is Queen of the Beach and excluded.
// Fall Friday (Rec/C 1PUJUOCteg_QNocGSrFhR5iWIm08hy-xUTEQzxAL9kDk) is still an un-rostered 2022 template; add it
// once the league publishes the 2026 roster.
export const LEAGUE_SOURCES: LeagueSource[] = [
  {
    slug: "fall-sundays",
    displayName: "Fall Sundays",
    session: "fall",
    year: 2026,
    day: "sunday",
    sheetId: "15tur6KgSRu3kUAqPHmf4sf9TKCOsbo4pvII95Aa7UHA",
  },
  {
    slug: "fall-mondays",
    displayName: "Fall Mondays",
    session: "fall",
    year: 2026,
    day: "monday",
    sheetId: "1G0r-N7PBe5sQENyz5AgNc-4Z1ItuF9aUu63bOeV8QVw",
    defaultDivision: "B",
  },
  {
    slug: "fall-tuesdays",
    displayName: "Fall Tuesdays",
    session: "fall",
    year: 2026,
    day: "tuesday",
    sheetId: "1xikgLuGrFTq0xbusZ-l8xr3R_OBoYIko18oNbLX56F8",
    defaultDivision: "B/BB",
  },
  {
    slug: "fall-wednesdays",
    displayName: "Fall Wednesdays",
    session: "fall",
    year: 2026,
    day: "wednesday",
    sheetId: "14hShtX2msZDB6K3MWh0QTkI7tiIXGE9NSRYcVGF5R1U",
    defaultDivision: "BB",
  },
];
