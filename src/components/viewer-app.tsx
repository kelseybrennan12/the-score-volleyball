"use client";

import { findTeamCandidates } from "@/shared/domain/lookup";
import { todayIsoInLeagueTimezone } from "@/shared/domain/next-match";
import type { SeasonArchive } from "@/shared/domain/seasons";
import type { Snapshot, Team } from "@/shared/domain/snapshot";
import { DAYS, VIEW_MODES, type ViewMode } from "@/shared/domain/viewer-selection";
import { formatDay } from "@/shared/format";
import { useMemo, useState } from "react";
import { DevTimePanel } from "./dev-time-panel";
import { NowView } from "./now-view";
import { StandingsView } from "./standings-view";
import { TeamDetail } from "./team-detail";
import { DivisionPill } from "./theme-tokens";
import { useViewerSelection } from "./use-viewer-selection";

export function ViewerApp({
  snapshots,
  seasons,
  mockNowIso,
}: {
  snapshots: Snapshot[];
  seasons: SeasonArchive[];
  mockNowIso: string | null;
}) {
  const availableDays = useMemo(() => DAYS.filter((d) => snapshots.some((s) => s.league.day === d)), [snapshots]);
  const now = useMemo(() => (mockNowIso ? new Date(mockNowIso) : new Date()), [mockNowIso]);
  const today = useMemo(() => todayIsoInLeagueTimezone(now), [now]);

  const {
    view,
    day: selectedDay,
    league: selectedLeagueSlug,
    standingsLeague,
    division: selectedDivision,
    daySnapshots: leagueOptions,
    selectedSnapshot,
    selectedTeam,
    team: selectedTeamNumber,
    actions,
  } = useViewerSelection(snapshots, today);
  const setView = actions.setView;

  const [query, setQuery] = useState("");

  const candidates = useMemo<Team[]>(() => {
    if (!selectedSnapshot) return [];
    if (query.trim().length === 0) {
      return [...selectedSnapshot.teams].sort((a, b) => a.number - b.number);
    }
    return findTeamCandidates(selectedSnapshot, query);
  }, [selectedSnapshot, query]);

  if (view === "now") {
    return (
      <div className="space-y-6">
        <DevTimePanel mockNowIso={mockNowIso} />
        <ViewToggle view={view} onChange={setView} />
        <NowView snapshots={snapshots} now={now} onSwitchToTeamView={() => void setView("team")} />
      </div>
    );
  }

  if (view === "standings") {
    return (
      <div className="space-y-6">
        <DevTimePanel mockNowIso={mockNowIso} />
        <ViewToggle view={view} onChange={setView} />
        <StandingsView
          snapshots={snapshots}
          seasons={seasons}
          selectedStandingsSlug={standingsLeague}
          selectedDivision={selectedDivision}
          onSelect={(leagueSlug, division) => actions.selectStandings(leagueSlug, division)}
        />
      </div>
    );
  }

  if (availableDays.length === 0) {
    return (
      <div className="space-y-6">
        <DevTimePanel mockNowIso={mockNowIso} />
        <ViewToggle view={view} onChange={setView} />
        <p className="text-sm text-neutral-600">No league snapshots are available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DevTimePanel mockNowIso={mockNowIso} />
      <ViewToggle view={view} onChange={setView} />

      <section>
        <label className="block text-sm font-medium text-neutral-700">Day</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                actions.selectDay(day);
                setQuery("");
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
            onChange={(e) => actions.selectLeague(e.target.value || null)}
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
              actions.selectTeam(null);
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
                <TeamCandidateList candidates={candidates} onSelect={(n) => actions.selectTeam(n)} />
              )}
            </div>
          )}
        </section>
      )}

      {selectedSnapshot && selectedTeam && <TeamDetail snapshot={selectedSnapshot} team={selectedTeam} now={now} />}
    </div>
  );
}

const VIEW_LABEL: Record<ViewMode, string> = {
  team: "Find My Team",
  now: "Now Playing",
  standings: "Standings",
};

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (next: ViewMode) => void }) {
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
          {VIEW_LABEL[mode]}
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
