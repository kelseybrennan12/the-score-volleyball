"use client";

import { buildTeamIcs, icsFilenameFor } from "@/shared/domain/calendar-export";
import { compareMatches, findNextMatchDate } from "@/shared/domain/next-match";
import type { Match, Snapshot, Team } from "@/shared/domain/snapshot";
import { computeTeamStats } from "@/shared/domain/stats";
import { useCallback, useMemo } from "react";

interface Props {
  snapshot: Snapshot;
  team: Team;
}

export function TeamDetail({ snapshot, team }: Props) {
  const stats = useMemo(() => computeTeamStats(snapshot), [snapshot]);
  const teamStats = stats.get(team.number);
  const teamMatches = useMemo(() => {
    return snapshot.matches.filter((m) => m.teamNumbers.includes(team.number)).sort(compareMatches);
  }, [snapshot, team.number]);
  const nextMatchDate = useMemo(() => findNextMatchDate(teamMatches), [teamMatches]);
  const upcomingMatches = useMemo(
    () => (nextMatchDate ? teamMatches.filter((m) => m.date === nextMatchDate) : []),
    [teamMatches, nextMatchDate],
  );
  const handleDownloadIcs = useCallback(() => {
    const ics = buildTeamIcs(snapshot, team);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = icsFilenameFor(snapshot, team);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [snapshot, team]);
  const hasMatches = teamMatches.length > 0;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              #{team.number} {team.captain}
            </h2>
            <p className="text-sm text-neutral-600">
              {snapshot.league.displayName} {snapshot.league.year} · {team.division} Division
            </p>
          </div>
          {teamStats && (
            <div className="text-right text-sm">
              <div className="font-medium">
                Record: {teamStats.setsWon}–{teamStats.setsLost} <span className="text-neutral-500">(sets)</span>
              </div>
              <div className="text-neutral-600">
                Rank {teamStats.rank} of {teamStats.divisionSize} in {teamStats.division}
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-500">Snapshot ingested {formatTimestamp(snapshot.ingestedAt)}</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleDownloadIcs}
            disabled={!hasMatches}
            title={hasMatches ? undefined : "No scheduled matches to export."}
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to calendar
          </button>
        </div>
      </div>

      {upcomingMatches.length > 0 && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {upcomingMatches.length === 1 ? "Next Match" : "Next Matches"} · {formatDate(upcomingMatches[0].date)}
          </div>
          <ul className="mt-2 divide-y divide-amber-200">
            {upcomingMatches.map((match, idx) => (
              <li key={`${match.time}-${match.court}-${idx}`} className="py-2 first:pt-0 last:pb-0">
                <MatchRow snapshot={snapshot} team={team} match={match} hideDate />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">Schedule</h3>
        {teamMatches.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
            No scheduled matches.
          </p>
        ) : (
          <div className="space-y-3">
            {groupMatchesByDate(teamMatches).map(([date, matches]) => (
              <section key={date} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {formatDate(date)}
                </header>
                <ul className="divide-y divide-neutral-200">
                  {matches.map((match, idx) => (
                    <li
                      key={`${match.date}-${match.time}-${match.court}-${idx}`}
                      className={`px-4 py-3 ${match.date === nextMatchDate ? "bg-amber-50" : ""}`}
                    >
                      <MatchRow snapshot={snapshot} team={team} match={match} hideDate />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MatchRow({
  snapshot,
  team,
  match,
  featured = false,
  hideDate = false,
}: {
  snapshot: Snapshot;
  team: Team;
  match: Match;
  featured?: boolean;
  hideDate?: boolean;
}) {
  const opponentNumber = match.teamNumbers[0] === team.number ? match.teamNumbers[1] : match.teamNumbers[0];
  const opponent = snapshot.teams.find((t) => t.number === opponentNumber);
  const opponentStats = useOpponentStats(snapshot, opponentNumber);
  const outcomeText = match.outcome.status === "played" ? outcomeLabel(match, team.number) : null;
  return (
    <div className={`flex items-baseline justify-between gap-3 ${featured ? "pt-2" : ""}`}>
      <div>
        <div className="text-sm font-medium">
          {hideDate ? "" : `${formatDate(match.date)} · `}
          {formatTime(match.time)} · {match.court}
        </div>
        <div className="text-sm text-neutral-700">
          vs #{opponentNumber} {opponent?.captain ?? "(unknown captain)"}
          {opponent && <span className="text-neutral-500"> · {opponent.division}</span>}
          {opponentStats && (
            <span className="text-neutral-500">
              {" "}
              · {opponentStats.setsWon}–{opponentStats.setsLost}
            </span>
          )}
        </div>
      </div>
      {outcomeText && (
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            outcomeText.startsWith("W") ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
          }`}
        >
          {outcomeText}
        </span>
      )}
    </div>
  );
}

function useOpponentStats(snapshot: Snapshot, opponentNumber: number) {
  const stats = useMemo(() => computeTeamStats(snapshot), [snapshot]);
  return stats.get(opponentNumber);
}

function outcomeLabel(match: Match, teamNumber: number): string | null {
  if (match.outcome.status !== "played") return null;
  const { winnerTeamNumber, setsWinner, setsLoser } = match.outcome;
  const didWin = winnerTeamNumber === teamNumber;
  const score = didWin ? `${setsWinner}-${setsLoser}` : `${setsLoser}-${setsWinner}`;
  return `${didWin ? "W" : "L"} ${score}`;
}

function groupMatchesByDate(matches: Match[]): [string, Match[]][] {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const list = groups.get(match.date) ?? [];
    list.push(match);
    groups.set(match.date, list);
  }
  return [...groups.entries()];
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
