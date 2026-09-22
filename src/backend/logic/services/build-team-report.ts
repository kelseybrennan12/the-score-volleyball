import type { Snapshot, Team } from "@/shared/domain/snapshot";
import { buildTeamDetail, type TeamDetail, type TeamMatch } from "@/shared/domain/team-detail";
import { formatTime } from "@/shared/format";

export type ReportFormat = "text" | "md";

export interface BuildReportInput {
  snapshots: Snapshot[];
  leagueSlug?: string;
  teamNumber?: number;
  format?: ReportFormat;
  now?: Date;
}

export function buildReport(input: BuildReportInput): string {
  const format = input.format ?? "text";
  const now = input.now ?? new Date();
  const filteredSnapshots = input.leagueSlug
    ? input.snapshots.filter((s) => s.league.slug === input.leagueSlug)
    : input.snapshots;
  if (filteredSnapshots.length === 0) {
    return "No snapshots match the requested filters.\n";
  }
  const blocks: string[] = [];
  for (const snapshot of filteredSnapshots) {
    const teams =
      input.teamNumber != null ? snapshot.teams.filter((t) => t.number === input.teamNumber) : snapshot.teams;
    const ordered = [...teams].sort((a, b) => a.number - b.number);
    for (const team of ordered) {
      blocks.push(renderTeamBlock(snapshot, team, buildTeamDetail(snapshot, team, now), format));
    }
  }
  if (blocks.length === 0) {
    return "No teams match the requested filters.\n";
  }
  const separator = format === "md" ? "\n\n" : "\n";
  return blocks.join(separator) + "\n";
}

function renderTeamBlock(snapshot: Snapshot, team: Team, detail: TeamDetail, format: ReportFormat): string {
  const leagueLabel = `${snapshot.league.displayName} ${snapshot.league.year}`;
  const { standingsRow } = detail;
  const statsLine = standingsRow
    ? `Record: ${standingsRow.setsWon}–${standingsRow.setsLost} (sets) · ${
        standingsRow.rank != null ? `Rank ${standingsRow.rankLabel} of ${standingsRow.divisionSize}` : "Unranked"
      } in ${standingsRow.division}`
    : "Record: unavailable";
  if (format === "md") {
    const rows = detail.matches.map(renderMarkdownRow);
    const header = "| Date | Time | Court | Opponent | Outcome |\n| --- | --- | --- | --- | --- |";
    return [
      `## ${leagueLabel} — ${team.division} Division — #${team.number} ${team.captain}`,
      statsLine,
      "",
      header,
      ...(rows.length > 0 ? rows : ["| _no scheduled matches_ |  |  |  |  |"]),
    ].join("\n");
  }
  const rows = detail.matches.map((entry) => `  ${renderTextRow(entry)}`);
  return [
    `${leagueLabel} — ${team.division} Division — #${team.number} ${team.captain}`,
    statsLine,
    ...(rows.length > 0 ? rows : ["  (no scheduled matches)"]),
  ].join("\n");
}

function renderTextRow(entry: TeamMatch): string {
  const { match, outcome } = entry;
  const outcomeTag = outcome ? ` [${outcome.label}]` : "";
  return `${match.date} ${formatTime(match.time)} ${match.court.padEnd(10, " ")} vs ${opponentLabel(entry)}${outcomeTag}`;
}

function renderMarkdownRow(entry: TeamMatch): string {
  const { match, outcome } = entry;
  return `| ${match.date} | ${formatTime(match.time)} | ${match.court} | ${opponentLabel(entry)} | ${outcome?.label ?? ""} |`;
}

function opponentLabel({ opponent, opponentNumber }: TeamMatch): string {
  return opponent ? `#${opponent.number} ${opponent.captain} (${opponent.division})` : `#${opponentNumber} (unknown)`;
}
