# The Score Beach Volleyball League Viewer

A read-only companion to thescoregr.com's beach volleyball leagues. It ingests the league's Google Sheets into snapshots
and lets players find their team, next match, record, and standings without opening the spreadsheets.

## Language

### Leagues and play

**League**: A day of the week within a session, e.g. "Fall Sundays". Has exactly one live snapshot at a time. _Avoid_:
night, day league

**Session**: The part of the year a league runs in: spring, summer, or fall. _Avoid_: season

**Season**: A session in a specific year, e.g. spring 2026. The live season is the one being played now; retired seasons
are frozen. _Avoid_: session, year

**Team**: A numbered roster led by a captain. Identified within a league by its number and captain name. _Avoid_:
roster, squad

**Division**: A skill tier within a league, e.g. B, BB, BBB. A combined label such as BB/BBB is one division with no
distinction inside it. Teams only ever play within their division, so record and rank are scoped to it. _Avoid_: level,
tier, bracket

**Match**: One meeting of two teams at a specific date, time, and court. _Avoid_: game, matchup

**Outcome**: Whether a match has been played and, if so, its set result for the first-listed team (3-0 or 2-1). _Avoid_:
result, score

**Record**: A team's sets won and sets lost across all of its played matches, all of which are within its division.

**Rank**: A team's ordinal position within its division by record. Tied teams share a rank, shown as T-N. _Avoid_:
standing, position

**Next match**: A team's earliest scheduled match whose calendar date is today or later in the league's timezone.
_Avoid_: upcoming game

### Ingestion

**Ingestion**: Fetching a league's spreadsheet and turning it into a snapshot. Runs daily on a schedule and on demand
from Admin. _Avoid_: sync, refresh, scrape

**Source list**: The checked-in list of leagues in scope for ingestion and which spreadsheet each one comes from.

**Snapshot**: The document produced by one ingestion of one league; what the viewer reads. _Avoid_: cache, data file

**Anomaly**: A note recorded during ingestion about spreadsheet content that could not be interpreted with confidence.
_Avoid_: warning, error

**Roster diff**: Whether a league's current team list differs from its previous snapshot. How session rollovers get
noticed.

**Rollback archive**: A league's recent prior snapshots, kept so an admin can restore one after a bad ingestion.
_Avoid_: history, backups

**Restore**: Making a rollback-archive snapshot the live snapshot for its league again. _Avoid_: revert, undo

**Season archive**: The frozen final snapshot of each league in a retired season, browsed under Previous Seasons.

### Viewer

**Viewer**: The single public page where players pick a league day, find a team, and see schedules and standings.
_Avoid_: app, site, dashboard

**Day selector**: The row of buttons for choosing a league day.

**Team search**: Finding a team by its number or its captain's name.

**Team detail**: A team's record, rank, next match, and full schedule.

**Now Playing**: The view of matches on court right now and up next on the selected day, grouped by court.

**Standings**: A per-division table of teams ordered by rank.

**Previous Seasons**: The collapsible section under Standings for browsing season archives.

**Calendar export**: Downloading a team's schedule as a calendar file.

**Favorite team**: A friends-of-the-house team whose detail page gets a highlighted header.

**Viewer selection**: The league day, league, and team a visitor has chosen in the viewer. Reflected in the URL and
remembered per browser. _Avoid_: state, filters

**Standings selection**: The league and division a visitor is viewing in Standings. Reflected in the URL and independent
of the viewer selection. _Avoid_: state, standings filter

### Announcements

**Announcement**: The admin-authored plain-text message shown to visitors, together with whether it is enabled. At most
one exists at a time. _Avoid_: banner (for the content), notice

**Announcement banner**: The on-page rendering of the current announcement, above the viewer. Always dismissable.
_Avoid_: alert, toast

**Dismissal**: A per-browser choice to hide one specific announcement. Does not carry over when the admin publishes the
announcement as new. _Avoid_: close, hide

### Admin

**Admin**: The passphrase-protected page where the operator runs ingestion, restores snapshots, and manages the
announcement. _Avoid_: dashboard, backoffice
