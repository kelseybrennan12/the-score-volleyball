"use client";

import { pickCurrentSnapshot } from "@/shared/domain/current-season";
import { findTeamCandidates } from "@/shared/domain/lookup";
import { todayIsoInLeagueTimezone } from "@/shared/domain/next-match";
import type { LeagueDay, Snapshot, Team } from "@/shared/domain/snapshot";
import { DAYS, validateUrlSelection } from "@/shared/domain/url-selection";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { NowView } from "./now-view";
import { TeamDetail } from "./team-detail";
import { DivisionPill } from "./theme-tokens";

const STORAGE_KEY = "volleyball-viewer:selection";
const VIEW_MODES = ["team", "now"] as const;

interface StoredSelection {
  day?: LeagueDay;
  leagueSlug?: string;
  teamNumber?: number;
}

function formatDay(day: LeagueDay): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

const dayParser = parseAsStringLiteral(DAYS);
const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault("team");

export function ViewerApp({ snapshots }: { snapshots: Snapshot[] }) {
  const snapshotsByDay = useMemo(() => groupByDay(snapshots), [snapshots]);
  const availableDays = DAYS.filter((d) => snapshotsByDay.get(d)?.length);
  const today = useMemo(() => todayIsoInLeagueTimezone(), []);

  const [view, setView] = useQueryState("view", viewParser.withOptions({ history: "replace", clearOnDefault: true }));
  const [selectedDay, setSelectedDay] = useQueryState("day", dayParser.withOptions({ history: "replace" }));
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useQueryState(
    "league",
    parseAsString.withOptions({ history: "replace" }),
  );
  const [selectedTeamNumber, setSelectedTeamNumber] = useQueryState(
    "team",
    parseAsInteger.withOptions({ history: "replace" }),
  );

  const [query, setQuery] = useState("");
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const validatedFromUrl = validateUrlSelection(snapshots, {
      day: selectedDay,
      league: selectedLeagueSlug,
      team: selectedTeamNumber,
    });

    let nextDay: LeagueDay | null = validatedFromUrl.day;
    let nextLeague: string | null = validatedFromUrl.league;
    let nextTeam: number | null = validatedFromUrl.team;

    if (nextDay == null && nextLeague == null && nextTeam == null) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as StoredSelection;
          const validatedFromStorage = validateUrlSelection(snapshots, {
            day: stored.day ?? null,
            league: stored.leagueSlug ?? null,
            team: stored.teamNumber ?? null,
          });
          nextDay = validatedFromStorage.day;
          nextLeague = validatedFromStorage.league;
          nextTeam = validatedFromStorage.team;
        }
      } catch {
        // Ignore storage or parse errors; fall back to defaults.
      }
    }

    if (nextDay && nextLeague == null) {
      const daySnapshots = snapshotsByDay.get(nextDay) ?? [];
      nextLeague = pickCurrentSnapshot(daySnapshots, today)?.league.slug ?? null;
    }

    if (nextDay !== selectedDay) void setSelectedDay(nextDay);
    if (nextLeague !== selectedLeagueSlug) void setSelectedLeagueSlug(nextLeague);
    if (nextTeam !== selectedTeamNumber) void setSelectedTeamNumber(nextTeam);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const selection: StoredSelection = {};
    if (selectedDay) selection.day = selectedDay;
    if (selectedLeagueSlug) selection.leagueSlug = selectedLeagueSlug;
    if (selectedTeamNumber != null) selection.teamNumber = selectedTeamNumber;
    try {
      if (Object.keys(selection).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
      }
    } catch {
      // Ignore storage errors (e.g. quota, private mode).
    }
  }, [selectedDay, selectedLeagueSlug, selectedTeamNumber]);

  const leagueOptions = selectedDay ? (snapshotsByDay.get(selectedDay) ?? []) : [];
  const selectedSnapshot = leagueOptions.find((s) => s.league.slug === selectedLeagueSlug) ?? null;

  const candidates = useMemo<Team[]>(() => {
    if (!selectedSnapshot) return [];
    if (query.trim().length === 0) {
      return [...selectedSnapshot.teams].sort((a, b) => a.number - b.number);
    }
    return findTeamCandidates(selectedSnapshot, query);
  }, [selectedSnapshot, query]);

  const selectedTeam = useMemo(() => {
    if (!selectedSnapshot || selectedTeamNumber == null) return null;
    return selectedSnapshot.teams.find((t) => t.number === selectedTeamNumber) ?? null;
  }, [selectedSnapshot, selectedTeamNumber]);

  if (view === "now") {
    return (
      <div className="space-y-6">
        <ViewToggle view={view} onChange={setView} />
        <NowView snapshots={snapshots} onSwitchToTeamView={() => void setView("team")} />
      </div>
    );
  }

  if (availableDays.length === 0) {
    return (
      <div className="space-y-6">
        <ViewToggle view={view} onChange={setView} />
        <p className="text-sm text-neutral-600">No league snapshots are available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ViewToggle view={view} onChange={setView} />

      <section>
        <label className="block text-sm font-medium text-neutral-700">Day</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                void setSelectedDay(day);
                const currentLeague = pickCurrentSnapshot(snapshotsByDay.get(day) ?? [], today);
                void setSelectedLeagueSlug(currentLeague?.league.slug ?? null);
                setQuery("");
                void setSelectedTeamNumber(null);
              }}
              className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                selectedDay === day
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-teal-300 hover:bg-teal-50"
              }`}
            >
              {formatDay(day)}
            </button>
          ))}
        </div>
      </section>

      {selectedDay && leagueOptions.length > 1 && (
        <section>
          <label className="block text-sm font-medium text-neutral-700">League</label>
          <select
            value={selectedLeagueSlug ?? ""}
            onChange={(e) => {
              void setSelectedLeagueSlug(e.target.value || null);
              void setSelectedTeamNumber(null);
            }}
            className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base sm:text-sm"
          >
            {leagueOptions.map((snap) => (
              <option key={snap.league.slug} value={snap.league.slug}>
                {snap.league.displayName} {snap.league.year}
              </option>
            ))}
          </select>
        </section>
      )}

      {selectedSnapshot && (
        <p className="text-xs text-neutral-500">
          <a
            href={`https://docs.google.com/spreadsheets/d/${selectedSnapshot.league.sourceSheetId}/view`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-teal-700 underline hover:text-teal-900"
          >
            View {selectedSnapshot.league.displayName} source spreadsheet ↗
          </a>
        </p>
      )}

      {selectedSnapshot && (
        <section>
          <label htmlFor="team-search" className="block text-sm font-medium text-neutral-700">
            Team number or captain name
          </label>
          <input
            id="team-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void setSelectedTeamNumber(null);
            }}
            placeholder="e.g. 7 or ryan"
            autoComplete="off"
            className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base sm:text-sm"
          />
          {selectedTeamNumber == null && (
            <div className="mt-2">
              {candidates.length === 0 ? (
                <p className="text-sm text-neutral-500">No teams match.</p>
              ) : (
                <TeamCandidateList candidates={candidates} onSelect={(n) => void setSelectedTeamNumber(n)} />
              )}
            </div>
          )}
        </section>
      )}

      {selectedSnapshot && selectedTeam && <TeamDetail snapshot={selectedSnapshot} team={selectedTeam} />}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: "team" | "now"; onChange: (next: "team" | "now") => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="View mode">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={view === mode}
          onClick={() => onChange(mode)}
          className={`rounded-md border px-3 py-1 text-sm transition-colors ${
            view === mode
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-neutral-300 bg-white text-neutral-800 hover:border-teal-300 hover:bg-teal-50"
          }`}
        >
          {mode === "team" ? "Find My Team" : "Now Playing"}
        </button>
      ))}
    </div>
  );
}

function TeamCandidateList({ candidates, onSelect }: { candidates: Team[]; onSelect: (teamNumber: number) => void }) {
  const divisions = new Map<string, Team[]>();
  for (const team of candidates) {
    const list = divisions.get(team.division) ?? [];
    list.push(team);
    divisions.set(team.division, list);
  }
  const groups = [...divisions.entries()];
  const multi = groups.length > 1;
  return (
    <div className="space-y-4">
      {groups.map(([division, teams]) => (
        <div key={division}>
          {multi && (
            <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <DivisionPill division={division} />
              <span>Division</span>
            </h4>
          )}
          <ul className="space-y-1">
            {teams.map((team) => (
              <li key={team.number}>
                <button
                  type="button"
                  onClick={() => onSelect(team.number)}
                  className="flex w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-teal-300 hover:bg-teal-50"
                >
                  <span className="font-medium">#{team.number}</span>
                  <span>{team.captain}</span>
                  {!multi && <DivisionPill division={team.division} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByDay(snapshots: Snapshot[]): Map<LeagueDay, Snapshot[]> {
  const grouped = new Map<LeagueDay, Snapshot[]>();
  for (const snap of snapshots) {
    const list = grouped.get(snap.league.day) ?? [];
    list.push(snap);
    grouped.set(snap.league.day, list);
  }
  return grouped;
}
