"use client";

import { selectNowMatches, type NowMatch } from "@/shared/domain/now-view";
import type { Snapshot } from "@/shared/domain/snapshot";
import { useMemo } from "react";
import { CourtLabel, DivisionPill } from "./theme-tokens";

const WEEKDAY_LABEL: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export function NowView({
  snapshots,
  now,
  onSwitchToTeamView,
}: {
  snapshots: Snapshot[];
  now: Date;
  onSwitchToTeamView: () => void;
}) {
  const selection = useMemo(() => selectNowMatches(snapshots, now), [now, snapshots]);

  const courts = [...selection.groupsByCourt.entries()].sort(([a], [b]) => a.localeCompare(b));
  const upcomingCourts = [...selection.upcomingByCourt.entries()].sort(([a], [b]) => a.localeCompare(b));
  const showLeagueLabels =
    new Set([...courts, ...upcomingCourts].flatMap(([, list]) => list.map((m) => m.snapshot.league.slug))).size > 1;
  const weekdayLabel = selection.todayWeekday ? WEEKDAY_LABEL[selection.todayWeekday] : null;

  return (
    <div className="space-y-4">
      {!selection.anyLeagueToday && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <p>No league plays on {weekdayLabel ?? "today"}.</p>
          <button
            type="button"
            onClick={onSwitchToTeamView}
            className="mt-2 text-sm font-medium text-teal-700 underline hover:text-teal-900"
          >
            Switch to Find My Team
          </button>
        </div>
      )}

      {selection.anyLeagueToday && courts.length === 0 && upcomingCourts.length === 0 && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <p>No more matches today.</p>
        </div>
      )}

      {courts.length > 0 && <CourtSection tense="now" courts={courts} showLeagueLabels={showLeagueLabels} />}

      {upcomingCourts.length > 0 && selection.nextUpcomingTime && (
        <CourtSection
          tense="upcoming"
          courts={upcomingCourts}
          showLeagueLabels={showLeagueLabels}
          fallbackTime={selection.nextUpcomingTime}
        />
      )}
    </div>
  );
}

function CourtSection({
  tense,
  courts,
  showLeagueLabels,
  fallbackTime,
}: {
  tense: "now" | "upcoming";
  courts: [string, NowMatch[]][];
  showLeagueLabels: boolean;
  fallbackTime?: string;
}) {
  const allMatches = courts.flatMap(([, list]) => list);
  const sharedTime = allUnique(allMatches.map((m) => m.match.time)) ?? fallbackTime ?? null;
  const sharedDivision = allUnique(
    allMatches.map(({ match, snapshot }) => snapshot.teams.find((t) => t.number === match.teamNumbers[0])?.division),
  );

  const label = tense === "now" ? "Now Playing" : "Up Next";
  const timeVerb = tense === "now" ? "Started at" : "Starts at";

  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-700">{label}</h3>
      {(sharedDivision || sharedTime) && (
        <div className="mt-0.5 mb-2 flex items-center gap-2 text-xs text-neutral-500">
          {sharedDivision && <DivisionPill division={sharedDivision} />}
          {sharedTime && <span>{`${timeVerb} ${formatTime(sharedTime)}`}</span>}
        </div>
      )}
      <CourtList
        courts={courts}
        showLeagueLabels={showLeagueLabels}
        showTimePerRow={!sharedTime}
        showDivisionPerRow={!sharedDivision}
      />
    </section>
  );
}

function CourtList({
  courts,
  showLeagueLabels,
  showTimePerRow,
  showDivisionPerRow,
}: {
  courts: [string, NowMatch[]][];
  showLeagueLabels: boolean;
  showTimePerRow: boolean;
  showDivisionPerRow: boolean;
}) {
  return (
    <ul className="space-y-3">
      {courts.map(([court, list]) => (
        <li key={court} className="rounded-md border border-neutral-200 bg-white p-3">
          <h4 className="mb-2 text-sm font-medium text-neutral-700">
            <CourtLabel court={court} />
          </h4>
          <ul className="space-y-1.5">
            {list.map(({ match, snapshot }) => {
              const teamA = snapshot.teams.find((t) => t.number === match.teamNumbers[0]);
              const teamB = snapshot.teams.find((t) => t.number === match.teamNumbers[1]);
              const division = teamA?.division ?? null;
              return (
                <li
                  key={`${snapshot.league.slug}-${match.date}-${match.time}-${match.teamNumbers.join("v")}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-800"
                >
                  {showTimePerRow && (
                    <span className="font-mono text-xs text-neutral-500">{formatTime(match.time)}</span>
                  )}
                  {showDivisionPerRow && division && <DivisionPill division={division} />}
                  <TeamLabel number={match.teamNumbers[0]} captain={teamA?.captain} />
                  <span className="text-neutral-400">vs</span>
                  <TeamLabel number={match.teamNumbers[1]} captain={teamB?.captain} />
                  {showLeagueLabels && (
                    <span className="ml-auto text-xs text-neutral-500">{snapshot.league.displayName}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function TeamLabel({ number, captain }: { number: number; captain?: string }) {
  return (
    <span className="font-medium">
      #{number}
      {captain && <span className="ml-1 font-normal text-neutral-600">{captain}</span>}
    </span>
  );
}

function allUnique<T extends string | undefined | null>(values: T[]): NonNullable<T> | null {
  const filtered = values.filter((v): v is NonNullable<T> => v != null && v !== "");
  if (filtered.length === 0) return null;
  const first = filtered[0]!;
  return filtered.every((v) => v === first) ? first : null;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}
