"use client";

import { buildTeamIcs, icsFilenameFor } from "@/shared/domain/calendar-export";
import type { Snapshot, Team } from "@/shared/domain/snapshot";
import { buildTeamDetail, type TeamMatch } from "@/shared/domain/team-detail";
import { isFavoriteTeam, parseFavoriteTeams } from "@/shared/favorites";
import { formatDate, formatTime, formatTimestamp } from "@/shared/format";
import { useCallback, useMemo } from "react";
import { CourtLabel, DivisionPill } from "./theme-tokens";

const FAVORITES = parseFavoriteTeams(process.env.NEXT_PUBLIC_FAVORITE_TEAMS);

interface Props {
  snapshot: Snapshot;
  team: Team;
  now: Date;
}

export function TeamDetail({ snapshot, team, now }: Props) {
  const detail = useMemo(() => buildTeamDetail(snapshot, team, now), [snapshot, team, now]);
  const { standingsRow, nextDate } = detail;
  const nextMatches = detail.matches.filter((entry) => entry.isNext);
  const handleDownloadIcs = useCallback(() => {
    const ics = buildTeamIcs(snapshot, team, now);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = icsFilenameFor(snapshot, team);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [snapshot, team, now]);
  const hasMatches = detail.matches.length > 0;
  const isFavorite = isFavoriteTeam(FAVORITES, snapshot.league.day, team.number);

  return (
    <section className="space-y-6">
      <div
        className={`relative overflow-hidden rounded-lg p-4 ${
          isFavorite ? "favorite-card animate-gradient-shift" : "border border-neutral-200 bg-white"
        }`}
      >
        {isFavorite && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 bottom-2 inline-block animate-wave text-4xl"
          >
            👋
          </span>
        )}
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              #{team.number} {team.captain}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
              <span>
                {snapshot.league.displayName} {snapshot.league.year}
              </span>
              <DivisionPill division={team.division} />
            </p>
          </div>
          {standingsRow && (
            <div className="text-right text-sm">
              <div className="font-medium">
                Record: {standingsRow.setsWon}–{standingsRow.setsLost} <span className="text-neutral-500">(sets)</span>
              </div>
              <div className="text-neutral-600">
                {standingsRow.rank != null
                  ? `Rank ${standingsRow.rankLabel} of ${standingsRow.divisionSize} in ${standingsRow.division}`
                  : `Unranked in ${standingsRow.division}`}
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
            📅 Add to calendar
          </button>
        </div>
      </div>

      {nextDate && nextMatches.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            {nextMatches.length === 1 ? "Next Match" : "Next Matches"} · {formatDate(nextDate)}
          </div>
          <ul className="mt-2 divide-y divide-rose-100">
            {nextMatches.map((entry, idx) => (
              <li key={`${entry.match.time}-${entry.match.court}-${idx}`} className="py-2 first:pt-0 last:pb-0">
                <MatchRow entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">Schedule</h3>
        {!hasMatches ? (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
            No scheduled matches.
          </p>
        ) : (
          <div className="space-y-3">
            {groupByDate(detail.matches).map(([date, entries]) => (
              <section key={date} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {formatDate(date)}
                </header>
                <ul className="divide-y divide-neutral-200">
                  {entries.map((entry, idx) => (
                    <li
                      key={`${entry.match.date}-${entry.match.time}-${entry.match.court}-${idx}`}
                      className="px-4 py-3"
                    >
                      <MatchRow entry={entry} />
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

function MatchRow({ entry }: { entry: TeamMatch }) {
  const { match, opponent, opponentNumber, opponentRecord, outcome } = entry;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
          <span>{formatTime(match.time)}</span>
          <span className="text-neutral-400">·</span>
          <CourtLabel court={match.court} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-neutral-700">
          <span>
            vs #{opponentNumber} {opponent?.captain ?? "(unknown captain)"}
          </span>
          {opponent && <DivisionPill division={opponent.division} />}
          {opponentRecord && (
            <span className="text-neutral-500">
              {opponentRecord.setsWon}–{opponentRecord.setsLost}
            </span>
          )}
        </div>
      </div>
      {outcome && (
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            outcome.won ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
          }`}
        >
          {outcome.label}
        </span>
      )}
    </div>
  );
}

/** The schedule's cards: one per calendar date, in schedule order. */
function groupByDate(entries: TeamMatch[]): [string, TeamMatch[]][] {
  const groups = new Map<string, TeamMatch[]>();
  for (const entry of entries) {
    const list = groups.get(entry.match.date) ?? [];
    list.push(entry);
    groups.set(entry.match.date, list);
  }
  return [...groups.entries()];
}
