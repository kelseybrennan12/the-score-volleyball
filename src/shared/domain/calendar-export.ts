import { LEAGUE_TIMEZONE } from "./next-match";
import type { Match, Snapshot, Team } from "./snapshot";
import { buildTeamDetail, type TeamMatch } from "./team-detail";

// League games run 50 minutes; the snapshot schema does not carry a per-match
// duration.
const EVENT_DURATION_MINUTES = 50;

const PRODID = "-//The Score Volleyball//Schedule Viewer//EN";
const UID_DOMAIN = "thescorevolleyball";

export function icsFilenameFor(snapshot: Snapshot, team: Team): string {
  return `${snapshot.league.slug}-team-${team.number}.ics`;
}

export function buildTeamIcs(snapshot: Snapshot, team: Team, now: Date = new Date()): string {
  const detail = buildTeamDetail(snapshot, team, now);
  // DTSTAMP and SEQUENCE both derive from the moment of generation so re-downloads
  // carry a newer revision marker. Without this, Google Calendar / Outlook see
  // an unchanged file and skip the update, leaving stale events in place.
  const dtstamp = toIcsUtcStamp(now.toISOString());
  const sequence = Math.floor(now.getTime() / 1000);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    `PRODID:${PRODID}`,
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...detroitVtimezoneLines(),
  ];
  for (const entry of detail.matches) {
    lines.push(...veventLines(snapshot, team, entry, dtstamp, sequence));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function veventLines(snapshot: Snapshot, team: Team, entry: TeamMatch, dtstamp: string, sequence: number): string[] {
  const { match, opponent, opponentNumber, outcome } = entry;
  const dtstart = toIcsLocalStamp(match.date, match.time);
  const dtend = toIcsLocalStamp(match.date, addMinutes(match.time, EVENT_DURATION_MINUTES));
  const summary = opponent
    ? `Volleyball vs #${opponent.number} ${opponent.captain} (${opponent.division})`
    : `Volleyball vs #${opponentNumber}`;
  const descriptionLines = [
    `${snapshot.league.displayName} ${snapshot.league.year}`,
    `Division: ${team.division}`,
    `Team: #${team.number} ${team.captain}`,
  ];
  if (outcome) descriptionLines.push(`Result: ${outcome.label}`);
  return [
    "BEGIN:VEVENT",
    `UID:${uidFor(snapshot, team, match)}`,
    `DTSTAMP:${dtstamp}`,
    `SEQUENCE:${sequence}`,
    `DTSTART;TZID=${LEAGUE_TIMEZONE}:${dtstart}`,
    `DTEND;TZID=${LEAGUE_TIMEZONE}:${dtend}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(match.court)}`,
    `DESCRIPTION:${escapeText(descriptionLines.join("\n"))}`,
    "END:VEVENT",
  ];
}

function uidFor(snapshot: Snapshot, team: Team, match: Match): string {
  const slug = snapshot.league.slug;
  const timeKey = match.time.replace(":", "");
  const courtKey = match.court.replace(/\s+/g, "-");
  return `match-${slug}-${team.number}-${match.date}-${timeKey}-${courtKey}@${UID_DOMAIN}`;
}

function detroitVtimezoneLines(): string[] {
  return [
    "BEGIN:VTIMEZONE",
    "TZID:America/Detroit",
    "X-LIC-LOCATION:America/Detroit",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

function toIcsLocalStamp(date: string, time: string): string {
  const [h, m] = time.split(":");
  return `${date.replace(/-/g, "")}T${h}${m}00`;
}

function toIcsUtcStamp(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((p) => Number.parseInt(p, 10));
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// RFC 5545 content lines must not exceed 75 octets; continuation lines start
// with a single whitespace character. Fold on octet boundaries (UTF-8 safe).
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const decoder = new TextDecoder();
  const out: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const limit = offset === 0 ? 75 : 74;
    let end = Math.min(offset + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    const chunk = decoder.decode(bytes.subarray(offset, end));
    out.push(offset === 0 ? chunk : ` ${chunk}`);
    offset = end;
  }
  return out.join("\r\n");
}
