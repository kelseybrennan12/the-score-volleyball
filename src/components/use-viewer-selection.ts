"use client";

import type { LeagueDay, Snapshot, Team } from "@/shared/domain/snapshot";
import {
  DAYS,
  planSelectDay,
  planSelectLeague,
  planSelectStandings,
  resolveViewerSelection,
  toStorageWrite,
  VIEW_MODES,
  type RawParams,
  type StoredSelection,
  type ViewMode,
} from "@/shared/domain/viewer-selection";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";

const STORAGE_KEY = "volleyball-viewer:selection";

/** Storage seam: browser local storage by default; tests pass an in-memory adapter. */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const localStorageAdapter: StorageAdapter = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
};

const dayParser = parseAsStringLiteral(DAYS).withOptions({ history: "replace" });
const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault("team").withOptions({
  history: "replace",
  clearOnDefault: true,
});
const stringParser = parseAsString.withOptions({ history: "replace" });
const intParser = parseAsInteger.withOptions({ history: "replace" });

export interface ViewerSelection {
  view: ViewMode;
  day: LeagueDay | null;
  league: string | null;
  team: number | null;
  division: string | null;
  daySnapshots: Snapshot[];
  selectedSnapshot: Snapshot | null;
  selectedTeam: Team | null;
}

export interface ViewerSelectionActions {
  selectDay(day: LeagueDay): void;
  selectLeague(slug: string | null): void;
  selectTeam(team: number | null): void;
  selectStandings(slug: string, division: string): void;
  setView(view: ViewMode): void;
}

/**
 * The single interface the viewer uses to read and write selection state. It binds the pure
 * {@link resolveViewerSelection} to the query-state library and to a storage adapter, so the viewer never touches
 * `nuqs` or `localStorage` directly.
 */
export function useViewerSelection(
  snapshots: Snapshot[],
  todayIso: string,
  storage: StorageAdapter = localStorageAdapter,
): ViewerSelection & { actions: ViewerSelectionActions } {
  const [view, setViewParam] = useQueryState("view", viewParser);
  const [day, setDay] = useQueryState("day", dayParser);
  const [league, setLeague] = useQueryState("league", stringParser);
  const [team, setTeam] = useQueryState("team", intParser);
  const [division, setDivision] = useQueryState("division", stringParser);

  const rawParams = useMemo<RawParams>(
    () => ({ view, day, league, team, division }),
    [view, day, league, team, division],
  );

  const readStored = useCallback((): StoredSelection | null => {
    try {
      const raw = storage.get(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSelection) : null;
    } catch {
      return null;
    }
  }, [storage]);

  const persist = useCallback(
    (next: { day: LeagueDay | null; league: string | null; team: number | null }) => {
      const write = toStorageWrite(next);
      try {
        if (write == null) storage.remove(STORAGE_KEY);
        else storage.set(STORAGE_KEY, JSON.stringify(write));
      } catch {
        // Swallow storage failures (quota, private mode).
      }
    },
    [storage],
  );

  // Displayed selection: derived from the raw parameters on every render, so a value that becomes stale after load is
  // dropped on the next render rather than surviving until reload.
  const { selection } = useMemo(
    () => resolveViewerSelection({ snapshots, params: rawParams, stored: null, todayIso }),
    [snapshots, rawParams, todayIso],
  );

  // Mount: hydrate from storage (when the URL names nothing) and clean up stale values, all with history replacement.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const result = resolveViewerSelection({ snapshots, params: rawParams, stored: readStored(), todayIso });
    const s = result.selection;
    if (s.day !== day) void setDay(s.day);
    if (s.league !== league) void setLeague(s.league);
    if (s.team !== team) void setTeam(s.team);
    persist({ day: s.day, league: s.league, team: s.team });
  }, []); // Mount-only: hydrate + clean up once against the initial params.

  const daySnapshots = useMemo(
    () => (selection.day ? snapshots.filter((s) => s.league.day === selection.day) : []),
    [snapshots, selection.day],
  );
  const selectedSnapshot = useMemo(
    () => daySnapshots.find((s) => s.league.slug === selection.league) ?? null,
    [daySnapshots, selection.league],
  );
  const selectedTeam = useMemo(() => {
    if (!selectedSnapshot || selection.team == null) return null;
    return selectedSnapshot.teams.find((t) => t.number === selection.team) ?? null;
  }, [selectedSnapshot, selection.team]);

  const actions = useMemo<ViewerSelectionActions>(
    () => ({
      selectDay(nextDay) {
        const plan = planSelectDay(snapshots, todayIso, nextDay);
        void setDay(plan.day);
        void setLeague(plan.league);
        void setTeam(plan.team);
        persist(plan);
      },
      selectLeague(slug) {
        const plan = planSelectLeague(slug);
        void setLeague(plan.league);
        void setTeam(plan.team);
        persist({ day: selection.day, league: plan.league, team: plan.team });
      },
      selectTeam(nextTeam) {
        void setTeam(nextTeam);
        persist({ day: selection.day, league: selection.league, team: nextTeam });
      },
      selectStandings(slug, nextDivision) {
        const plan = planSelectStandings(slug, nextDivision);
        void setLeague(plan.league);
        void setDivision(plan.division);
        persist({ day: selection.day, league: plan.league, team: selection.team });
      },
      setView(nextView) {
        void setViewParam(nextView);
      },
    }),
    [
      snapshots,
      todayIso,
      selection.day,
      selection.league,
      selection.team,
      setDay,
      setLeague,
      setTeam,
      setDivision,
      setViewParam,
      persist,
    ],
  );

  return { ...selection, daySnapshots, selectedSnapshot, selectedTeam, actions };
}
