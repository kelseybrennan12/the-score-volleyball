"use client";

import { pickCurrentSnapshot } from "@/shared/domain/current-season";
import { findTeamCandidates } from "@/shared/domain/lookup";
import { todayIsoInLeagueTimezone } from "@/shared/domain/next-match";
import type { LeagueDay, Snapshot, Team } from "@/shared/domain/snapshot";
import { useMemo, useState } from "react";
import { TeamDetail } from "./team-detail";

const DAYS: LeagueDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

function formatDay(day: LeagueDay): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function ViewerApp({ snapshots }: { snapshots: Snapshot[] }) {
  const snapshotsByDay = useMemo(() => groupByDay(snapshots), [snapshots]);
  const availableDays = DAYS.filter((d) => snapshotsByDay.get(d)?.length);
  const today = useMemo(() => todayIsoInLeagueTimezone(), []);
  const [selectedDay, setSelectedDay] = useState<LeagueDay | null>(null);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);

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

  if (availableDays.length === 0) {
    return <p className="text-sm text-neutral-600">No league snapshots are available yet.</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <label className="block text-sm font-medium text-neutral-700">Day</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                setSelectedDay(day);
                const currentLeague = pickCurrentSnapshot(snapshotsByDay.get(day) ?? [], today);
                setSelectedLeagueSlug(currentLeague?.league.slug ?? null);
                setQuery("");
                setSelectedTeamNumber(null);
              }}
              className={`rounded-md border px-3 py-1 text-sm ${
                selectedDay === day
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
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
              setSelectedLeagueSlug(e.target.value);
              setSelectedTeamNumber(null);
            }}
            className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
              setSelectedTeamNumber(null);
            }}
            placeholder="e.g. 7 or ryan"
            autoComplete="off"
            className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {selectedTeamNumber == null && (
            <ul className="mt-2 space-y-1">
              {candidates.length === 0 && <li className="text-sm text-neutral-500">No teams match.</li>}
              {candidates.map((team) => (
                <li key={team.number}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamNumber(team.number)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm hover:bg-neutral-100"
                  >
                    <span className="font-medium">#{team.number}</span> {team.captain}{" "}
                    <span className="text-neutral-500">· {team.division}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedSnapshot && selectedTeam && <TeamDetail snapshot={selectedSnapshot} team={selectedTeam} />}
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
