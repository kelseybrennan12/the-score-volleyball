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
  const cleaned = label.replace(/(st|nd|rd|th)/i, "").trim();
  const match = cleaned.match(/^([A-Za-z]+)\s+(\d+)$/);
  if (!match) return null;
  const monthIndex = MONTH_NAMES.indexOf(match[1].toLowerCase());
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
