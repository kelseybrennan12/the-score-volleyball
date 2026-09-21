"use client";

import type { LeagueDay, Snapshot, Team } from "@/shared/domain/snapshot";
import {
  DAYS,
  planSelectDay,
  resolveViewerSelection,
  snapshotsForDay,
  toStorageWrite,
  VIEW_MODES,
  type RawParams,
  type ResolvedSelection,
  type UrlWrites,
  type ViewMode,
} from "@/shared/domain/viewer-selection";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  localStorageAdapter,
  readStoredSelection,
  writeStoredSelection,
  type StorageAdapter,
} from "./selection-storage";

const dayParser = parseAsStringLiteral(DAYS).withOptions({ history: "replace" });
const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault("team").withOptions({
  history: "replace",
  clearOnDefault: true,
});
const stringParser = parseAsString.withOptions({ history: "replace" });
const intParser = parseAsInteger.withOptions({ history: "replace" });

export interface ViewerSelection extends ResolvedSelection {
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
 * The single interface the viewer uses to read and write the Viewer selection and the Standings selection. It binds
 * the pure {@link resolveViewerSelection} to the query-state library and to a storage adapter, so the viewer never
 * touches `nuqs` or `localStorage` directly.
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
  const [standings, setStandings] = useQueryState("standings", stringParser);
  const [division, setDivision] = useQueryState("division", stringParser);

  const rawParams = useMemo<RawParams>(
    () => ({ view, day, league, team, standings, division }),
    [view, day, league, team, standings, division],
  );

  const applyUrlWrites = useCallback(
    (writes: UrlWrites) => {
      if ("day" in writes) void setDay(writes.day ?? null);
      if ("league" in writes) void setLeague(writes.league ?? null);
      if ("team" in writes) void setTeam(writes.team ?? null);
      if ("standings" in writes) void setStandings(writes.standings ?? null);
      if ("division" in writes) void setDivision(writes.division ?? null);
    },
    [setDay, setLeague, setTeam, setStandings, setDivision],
  );

  // Displayed selection: derived from the raw parameters on every render, so a value that becomes stale after load is
  // dropped on the next render rather than surviving until reload.
  const { selection } = useMemo(
    () => resolveViewerSelection({ snapshots, params: rawParams, stored: null, todayIso }),
    [snapshots, rawParams, todayIso],
  );

  // Mount: hydrate from storage (when the URL names nothing), migrate old-shape standings links, and clean up stale
  // values, all with history replacement. A non-empty resolution is remembered; mount never clears storage.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const resolved = resolveViewerSelection({
      snapshots,
      params: rawParams,
      stored: readStoredSelection(storage),
      todayIso,
    });
    applyUrlWrites(resolved.urlWrites);
    if (resolved.storageWrite) writeStoredSelection(storage, resolved.storageWrite);
  }, []); // Mount-only: hydrate + clean up once against the initial params.

  const daySnapshots = useMemo(
    () => (selection.day ? snapshotsForDay(snapshots, selection.day) : []),
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
        const next = planSelectDay(snapshots, todayIso, nextDay);
        applyUrlWrites(next);
        writeStoredSelection(storage, toStorageWrite(next));
      },
      selectLeague(slug) {
        const next = { day: selection.day, league: slug, team: null };
        applyUrlWrites({ league: slug, team: null });
        writeStoredSelection(storage, toStorageWrite(next));
      },
      selectTeam(nextTeam) {
        const next = { day: selection.day, league: selection.league, team: nextTeam };
        applyUrlWrites({ team: nextTeam });
        writeStoredSelection(storage, toStorageWrite(next));
      },
      selectStandings(slug, nextDivision) {
        // Standings selection is URL-only and never touches day, league, or team, so a chosen team survives browsing.
        applyUrlWrites({ standings: slug, division: nextDivision });
      },
      setView(nextView) {
        void setViewParam(nextView);
      },
    }),
    [snapshots, todayIso, selection.day, selection.league, applyUrlWrites, setViewParam, storage],
  );

  return { ...selection, daySnapshots, selectedSnapshot, selectedTeam, actions };
}
