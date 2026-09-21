import { pickCurrentSnapshot } from "./current-season";
import type { LeagueDay, Snapshot } from "./snapshot";

export const DAYS: readonly LeagueDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const;

export const VIEW_MODES = ["team", "now", "standings"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** Per-browser remembered selection. Shape is unchanged from the original viewer. */
export interface StoredSelection {
  day?: LeagueDay;
  leagueSlug?: string;
  teamNumber?: number;
}

/** Raw query-parameter values as read from the URL (already type-coerced by the query-state library). */
export interface RawParams {
  view: string | null;
  day: string | null;
  league: string | null;
  team: number | null;
  standings: string | null;
  division: string | null;
}

/** The validated selection the viewer renders from. */
export interface ResolvedSelection {
  view: ViewMode;
  day: LeagueDay | null;
  league: string | null;
  team: number | null;
  /** League slug for the Standings table; independent of the Team-search `league`. */
  standingsLeague: string | null;
  division: string | null;
}

/**
 * URL parameters whose value must change to match the resolved selection. A key is present only when the raw
 * parameter and the resolved value differ; `null` means "remove the parameter". `view` is never rewritten.
 */
export interface UrlWrites {
  day?: LeagueDay | null;
  league?: string | null;
  team?: number | null;
  standings?: string | null;
  division?: string | null;
}

export interface ResolveResult {
  selection: ResolvedSelection;
  /** URL rewrites needed to make the displayed URL match the resolved selection (empty when it already does). */
  urlWrites: UrlWrites;
  /** The selection worth remembering, or `null` when there is nothing to remember. Never a request to clear storage. */
  storageWrite: StoredSelection | null;
}

// --- Day → league → team validation (folded in from the former url-selection module) ---

export interface RawSelection {
  day: string | null;
  league: string | null;
  team: number | null;
}

export interface ValidatedSelection {
  day: LeagueDay | null;
  league: string | null;
  team: number | null;
}

export function isLeagueDay(value: string | null): value is LeagueDay {
  return value != null && (DAYS as readonly string[]).includes(value);
}

/**
 * Day → league → team cascade: an invalid parent drops all of its children. Applied to both the URL and the
 * remembered selection.
 */
export function validateSelection(snapshots: Snapshot[], raw: RawSelection): ValidatedSelection {
  const day = isLeagueDay(raw.day) ? raw.day : null;

  if (day == null) {
    return { day: null, league: null, team: null };
  }

  const daySnapshots = snapshotsForDay(snapshots, day);
  const league = raw.league != null && daySnapshots.some((s) => s.league.slug === raw.league) ? raw.league : null;

  if (league == null) {
    return { day, league: null, team: null };
  }

  const snapshot = daySnapshots.find((s) => s.league.slug === league) ?? null;
  const team = raw.team != null && snapshot?.teams.some((t) => t.number === raw.team) ? raw.team : null;

  return { day, league, team };
}

export function snapshotsForDay(snapshots: Snapshot[], day: LeagueDay): Snapshot[] {
  return snapshots.filter((s) => s.league.day === day);
}

/**
 * Validate the Standings selection. `standings` names the table's league snapshot and `division` a division present in
 * that snapshot's teams; if either is invalid both are dropped so the pill row shows nothing selected.
 *
 * Transitional: in the standings view a bare `league` (with no `standings`) is read as the table's league — the shape
 * the app used to write. `foldedLeague` reports when that happened so the caller can treat `league` as consumed rather
 * than as a Team-search parameter. Remove with the fallback in a later release.
 */
export function resolveStandingsSelection(
  snapshots: Snapshot[],
  view: ViewMode,
  params: Pick<RawParams, "standings" | "league" | "division">,
): { standingsLeague: string | null; division: string | null; foldedLeague: boolean } {
  const none = { standingsLeague: null, division: null, foldedLeague: false };
  const folding = params.standings == null && view === "standings" && params.league != null;
  const slug = params.standings ?? (folding ? params.league : null);
  if (slug == null) return none;

  const snapshot = snapshots.find((s) => s.league.slug === slug) ?? null;
  if (snapshot == null) return none;

  const division =
    params.division != null && snapshot.teams.some((t) => t.division === params.division) ? params.division : null;
  if (division == null) return none;

  return { standingsLeague: slug, division, foldedLeague: folding };
}

/** The league that is live today for a given day, used when a day has no explicit league. */
export function pickDefaultLeagueSlug(snapshots: Snapshot[], day: LeagueDay, todayIso: string): string | null {
  return pickCurrentSnapshot(snapshotsForDay(snapshots, day), todayIso)?.league.slug ?? null;
}

function validateView(value: string | null): ViewMode {
  return value != null && (VIEW_MODES as readonly string[]).includes(value) ? (value as ViewMode) : "team";
}

/** Shape a validated selection into the persisted `StoredSelection`; `null` when nothing is worth remembering. */
export function toStorageWrite(sel: ValidatedSelection): StoredSelection | null {
  const stored: StoredSelection = {};
  if (sel.day) stored.day = sel.day;
  if (sel.league) stored.leagueSlug = sel.league;
  if (sel.team != null) stored.teamNumber = sel.team;
  return Object.keys(stored).length === 0 ? null : stored;
}

/**
 * Resolve the Viewer selection from the raw URL parameters, the remembered selection, and today's date.
 *
 * Pure: given the same inputs it returns the same validated selection plus the writes to make (URL rewrites and the
 * value to remember). The hook binds it to the query-state library and to a storage adapter.
 */
export function resolveViewerSelection(args: {
  snapshots: Snapshot[];
  params: RawParams;
  /** The remembered selection, or `null` to skip consulting storage (e.g. non-mount renders). */
  stored: StoredSelection | null;
  todayIso: string;
}): ResolveResult {
  const { snapshots, params, stored, todayIso } = args;
  const view = validateView(params.view);

  // Standings selection lives in its own parameters (`standings`, `division`) and is validated independently of the
  // Team-search day/league/team below. When an old-shape link's `league` is folded into it, that `league` is consumed
  // and no longer counts as the URL naming a Team-search league.
  const standings = resolveStandingsSelection(snapshots, view, params);
  const urlLeague = standings.foldedLeague ? null : params.league;

  // The remembered selection is consulted only when the URL names none of day/league/team (all-or-nothing). A partial
  // URL is a deliberate link and is taken as-is.
  const urlNamesNone = params.day == null && urlLeague == null && params.team == null;
  const base: RawSelection =
    urlNamesNone && stored != null
      ? { day: stored.day ?? null, league: stored.leagueSlug ?? null, team: stored.teamNumber ?? null }
      : { day: params.day, league: urlLeague, team: params.team };

  let validated = validateSelection(snapshots, base);

  if (validated.day != null && validated.league == null) {
    validated = { ...validated, league: pickDefaultLeagueSlug(snapshots, validated.day, todayIso) };
  }

  const selection: ResolvedSelection = {
    view,
    ...validated,
    standingsLeague: standings.standingsLeague,
    division: standings.division,
  };

  return {
    selection,
    urlWrites: diffUrl(params, selection),
    storageWrite: toStorageWrite(validated),
  };
}

function diffUrl(params: RawParams, selection: ResolvedSelection): UrlWrites {
  const writes: UrlWrites = {};
  if (params.day !== selection.day) writes.day = selection.day;
  if (params.league !== selection.league) writes.league = selection.league;
  if (params.team !== selection.team) writes.team = selection.team;
  if (params.standings !== selection.standingsLeague) writes.standings = selection.standingsLeague;
  if (params.division !== selection.division) writes.division = selection.division;
  return writes;
}

/** Selecting a day lands on the league that is live today for that day and clears the team. */
export function planSelectDay(
  snapshots: Snapshot[],
  todayIso: string,
  day: LeagueDay,
): { day: LeagueDay; league: string | null; team: null } {
  return { day, league: pickDefaultLeagueSlug(snapshots, day, todayIso), team: null };
}
