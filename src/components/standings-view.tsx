"use client";

import type { SeasonArchive } from "@/shared/domain/seasons";
import type { Snapshot } from "@/shared/domain/snapshot";
import { buildStandings, listStandingsOptions, type StandingsOption } from "@/shared/domain/standings";
import { useMemo, useState } from "react";
import { DivisionPill } from "./theme-tokens";

interface Props {
  snapshots: Snapshot[];
  seasons: SeasonArchive[];
  selectedLeagueSlug: string | null;
  selectedDivision: string | null;
  onSelect: (leagueSlug: string, division: string) => void;
}

export function StandingsView({ snapshots, seasons, selectedLeagueSlug, selectedDivision, onSelect }: Props) {
  const hasCurrent = listStandingsOptions(snapshots).length > 0;

  if (!hasCurrent && seasons.length === 0) {
    return <p className="text-sm text-neutral-600">No standings available yet.</p>;
  }

  return (
    <div className="space-y-8">
      {hasCurrent && (
        <StandingsBrowser
          snapshots={snapshots}
          selectedLeagueSlug={selectedLeagueSlug}
          selectedDivision={selectedDivision}
          onSelect={onSelect}
        />
      )}
      {seasons.length > 0 && <PreviousSeasons seasons={seasons} />}
    </div>
  );
}

/** Pill row + standings table for a single set of league snapshots (current season or an archived one). */
function StandingsBrowser({
  snapshots,
  selectedLeagueSlug,
  selectedDivision,
  onSelect,
}: {
  snapshots: Snapshot[];
  selectedLeagueSlug: string | null;
  selectedDivision: string | null;
  onSelect: (leagueSlug: string, division: string) => void;
}) {
  const options = useMemo(() => listStandingsOptions(snapshots), [snapshots]);
  const selectedOption =
    options.find((o) => o.leagueSlug === selectedLeagueSlug && o.division === selectedDivision) ?? null;

  if (options.length === 0) {
    return <p className="text-sm text-neutral-600">No standings available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <section>
        <label className="block text-sm font-medium text-neutral-700">League</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => {
            const isSelected = selectedOption != null && optionKey(o) === optionKey(selectedOption);
            return (
              <button
                key={optionKey(o)}
                type="button"
                onClick={() => onSelect(o.leagueSlug, o.division)}
                className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                  isSelected
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-800 hover:border-teal-300 hover:bg-teal-50"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </section>

      {selectedOption && <StandingsTable snapshots={snapshots} option={selectedOption} />}
    </div>
  );
}

/** Collapsible section listing archived past seasons, each browsable with its own local selection. */
function PreviousSeasons({ seasons }: { seasons: SeasonArchive[] }) {
  const [open, setOpen] = useState(false);
  const [seasonKey, setSeasonKey] = useState(seasons[0]?.key ?? null);
  const [selection, setSelection] = useState<{ leagueSlug: string; division: string } | null>(null);

  const activeSeason = seasons.find((s) => s.key === seasonKey) ?? seasons[0] ?? null;

  return (
    <section className="border-t border-neutral-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-neutral-700 hover:text-teal-700"
      >
        <span>Previous Seasons</span>
        <span className="flex items-center gap-1 text-xs font-normal text-neutral-500">
          {open ? "Collapse" : "Expand"}
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && activeSeason && (
        <div className="mt-4 space-y-4">
          {seasons.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSeasonKey(s.key);
                    setSelection(null);
                  }}
                  className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                    s.key === activeSeason.key
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-800 hover:border-teal-300 hover:bg-teal-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {seasons.length === 1 && <p className="text-xs font-medium text-neutral-500">{activeSeason.label}</p>}

          <StandingsBrowser
            snapshots={activeSeason.snapshots}
            selectedLeagueSlug={selection?.leagueSlug ?? null}
            selectedDivision={selection?.division ?? null}
            onSelect={(leagueSlug, division) => setSelection({ leagueSlug, division })}
          />
        </div>
      )}
    </section>
  );
}

function StandingsTable({ snapshots, option }: { snapshots: Snapshot[]; option: StandingsOption }) {
  const snapshot = snapshots.find((s) => s.league.slug === option.leagueSlug);
  const standings = useMemo(() => (snapshot ? buildStandings(snapshot, option.division) : null), [snapshot, option]);
  if (!snapshot || !standings) return null;

  const anyTies = standings.rows.some((r) => r.isTied);

  return (
    <section>
      <header className="mb-2 flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-neutral-700">
          {snapshot.league.displayName} {snapshot.league.year}
        </h3>
        <DivisionPill division={option.division} />
      </header>
      {standings.rows.length === 0 ? (
        <p className="text-sm text-neutral-600">No teams in this division.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-md text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-1.5 pl-2 pr-2 text-left font-medium">Rank</th>
              <th className="py-1.5 pr-2 text-left font-medium">Team</th>
              <th className="py-1.5 pl-2 pr-2 text-right font-medium">Sets W–L</th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row, idx) => (
              <tr key={row.teamNumber} className={idx % 2 === 1 ? "bg-neutral-100" : "bg-white"}>
                <td className="py-1.5 pr-2 pl-2">
                  <span
                    className={`${row.isTied ? "font-semibold text-amber-700" : "text-neutral-700"} ${
                      row.rank == null ? "text-neutral-400" : ""
                    }`}
                  >
                    {row.rankLabel}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-neutral-800">
                  <span className="font-medium">#{row.teamNumber}</span>
                  <span className="ml-1 text-neutral-600">{row.captain}</span>
                </td>
                <td className="py-1.5 pl-2 pr-2 text-right text-neutral-700">
                  {row.setsWon}–{row.setsLost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {anyTies && (
        <p className="mt-2 text-xs text-neutral-500">
          <span className="font-semibold text-amber-700">T-N</span> marks teams tied at the same sets won and sets lost.
        </p>
      )}
    </section>
  );
}

function optionKey(o: StandingsOption): string {
  return `${o.leagueSlug}::${o.division}`;
}
