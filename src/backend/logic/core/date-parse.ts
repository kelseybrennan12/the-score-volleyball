const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function parseMonthDay(label: string, year: number): string | null {
  const trimmed = label.trim();
  // ExcelJS returns cells that are actual Date values as ISO-8601 strings via
  // the parser's cellText helper. Accept a YYYY-MM-DD prefix so such columns
  // still resolve to a date. The caller already knows the league's year; we
  // trust whatever year is in the ISO prefix since it originates from the
  // sheet itself.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (isoMatch) {
    const [, y, mm, dd] = isoMatch;
    const day = Number.parseInt(dd, 10);
    const monthIndex = Number.parseInt(mm, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    return `${y}-${mm}-${dd}`;
  }
  // Accept any trailing letters after the day number so typos like "June 10h"
  // (missing the "t" in "th") still parse.
  const match = trimmed.match(/^([A-Za-z]+)\.?\s+(\d+)[a-z]*\.?$/i);
  if (!match) return null;
  const monthToken = match[1].toLowerCase();
  let monthIndex = MONTH_NAMES.indexOf(monthToken);
  if (monthIndex === -1) {
    monthIndex = MONTH_NAMES.findIndex((m) => m.startsWith(monthToken));
  }
  if (monthIndex === -1) return null;
  const day = Number.parseInt(match[2], 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseTimeLabel(label: string): { time: string; court: string } | null {
  const trimmed = label.replace(/\s+/g, " ").trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(.+)$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return { time: `${hh}:${mm}`, court: match[4].trim() };
}
