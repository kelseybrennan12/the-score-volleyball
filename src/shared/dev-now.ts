export const MOCK_NOW_COOKIE = "mockNow";

export const IS_DEV = process.env.NODE_ENV === "development";

export function parseMockNow(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function readMockNowFromCookieHeader(cookieHeader: string | undefined | null): Date | null {
  if (!IS_DEV || !cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName?.trim() === MOCK_NOW_COOKIE) {
      return parseMockNow(decodeURIComponent(rest.join("=").trim()));
    }
  }
  return null;
}
