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
  division: string | null;
}

/** The validated selection the viewer renders from. */
export interface ResolvedSelection {
  view: ViewMode;
  day: LeagueDay | null;
  league: string | null;
  team: number | null;
  division: string | null;
}

export interface ResolveResult {
  selection: ResolvedSelection;
  /** Desired persisted value; `null` means remove the stored entry. */
  storageWrite: StoredSelection | null;
}

// --- URL-validation helper (folded in from the former url-selection module) ---

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

/** Day → league → team cascade: an invalid parent drops all of its children. */
export function validateUrlSelection(snapshots: Snapshot[], raw: RawSelection): ValidatedSelection {
  const day = isLeagueDay(raw.day) ? raw.day : null;

  if (day == null) {
    return { day: null, league: null, team: null };
  }

  const daySnapshots = snapshots.filter((s) => s.league.day === day);
  const league = raw.league != null && daySnapshots.some((s) => s.league.slug === raw.league) ? raw.league : null;

  if (league == null) {
    return { day, league: null, team: null };
  }

  const snapshot = daySnapshots.find((s) => s.league.slug === league) ?? null;
  const team = raw.team != null && snapshot?.teams.some((t) => t.number === raw.team) ? raw.team : null;

  return { day, league, team };
}

/** The league that is live today for a given day, used when a day has no explicit league. */
export function pickDefaultLeagueSlug(snapshots: Snapshot[], day: LeagueDay, todayIso: string): string | null {
  const daySnapshots = snapshots.filter((s) => s.league.day === day);
  return pickCurrentSnapshot(daySnapshots, todayIso)?.league.slug ?? null;
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
 * Pure: given the same inputs it returns the same validated selection plus the value to persist. The hook binds it to
 * the query-state library and to a storage adapter.
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

  // In `standings` view the `league` parameter names the Standings table's league (any active snapshot), not a
  // day-scoped Team-search league, so it is passed through untouched this ticket. #9 gives Standings its own
  // parameters and removes this branch.
  if (view === "standings") {
    const day = isLeagueDay(params.day) ? params.day : null;
    return {
      selection: { view, day, league: params.league, team: params.team, division: params.division },
      storageWrite: toStorageWrite({ day, league: params.league, team: params.team }),
    };
  }

  // The remembered selection is consulted only when the URL names none of day/league/team (all-or-nothing). A partial
  // URL is a deliberate link and is taken as-is.
  const urlNamesNone = params.day == null && params.league == null && params.team == null;
  const base: RawSelection =
    urlNamesNone && stored != null
      ? { day: stored.day ?? null, league: stored.leagueSlug ?? null, team: stored.teamNumber ?? null }
      : { day: params.day, league: params.league, team: params.team };

  let validated = validateUrlSelection(snapshots, base);

  if (validated.day != null && validated.league == null) {
    validated = { ...validated, league: pickDefaultLeagueSlug(snapshots, validated.day, todayIso) };
  }

  return {
    selection: { view, ...validated, division: params.division },
    storageWrite: toStorageWrite(validated),
  };
}

// --- Action planners: the observable effect of each user action on the selection. ---

export function planSelectDay(
  snapshots: Snapshot[],
  todayIso: string,
  day: LeagueDay,
): { day: LeagueDay; league: string | null; team: null } {
  return { day, league: pickDefaultLeagueSlug(snapshots, day, todayIso), team: null };
}

export function planSelectLeague(slug: string | null): { league: string | null; team: null } {
  return { league: slug, team: null };
}

export function planSelectTeam(team: number | null): { team: number | null } {
  return { team };
}

export function planSelectStandings(slug: string, division: string): { league: string; division: string } {
  return { league: slug, division };
}
