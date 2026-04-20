import { compareMatches } from "@/shared/domain/next-match";
import type { Match, Snapshot, Team } from "@/shared/domain/snapshot";
import { computeTeamStats, type TeamStats } from "@/shared/domain/stats";

export type ReportFormat = "text" | "md";

export interface BuildReportInput {
  snapshots: Snapshot[];
  leagueSlug?: string;
  teamNumber?: number;
  format?: ReportFormat;
}

export function buildReport(input: BuildReportInput): string {
  const format = input.format ?? "text";
  const filteredSnapshots = input.leagueSlug
    ? input.snapshots.filter((s) => s.league.slug === input.leagueSlug)
    : input.snapshots;
  if (filteredSnapshots.length === 0) {
    return "No snapshots match the requested filters.\n";
  }
  const blocks: string[] = [];
  for (const snapshot of filteredSnapshots) {
    const stats = computeTeamStats(snapshot);
    const teams =
      input.teamNumber != null ? snapshot.teams.filter((t) => t.number === input.teamNumber) : snapshot.teams;
    const ordered = [...teams].sort((a, b) => a.number - b.number);
    for (const team of ordered) {
      blocks.push(renderTeamBlock(snapshot, team, stats.get(team.number), format));
    }
  }
  if (blocks.length === 0) {
    return "No teams match the requested filters.\n";
  }
  const separator = format === "md" ? "\n\n" : "\n";
  return blocks.join(separator) + "\n";
}

function renderTeamBlock(snapshot: Snapshot, team: Team, stats: TeamStats | undefined, format: ReportFormat): string {
  const teamMatches = snapshot.matches.filter((m) => m.teamNumbers.includes(team.number)).sort(compareMatches);
  const leagueLabel = `${snapshot.league.displayName} ${snapshot.league.year}`;
  const statsLine = stats
    ? `Record: ${stats.setsWon}–${stats.setsLost} (sets) · Rank ${stats.rank} of ${stats.divisionSize} in ${stats.division}`
    : "Record: unavailable";
  if (format === "md") {
    const rows = teamMatches.map((m) => renderMarkdownRow(snapshot, team, m));
    const header = "| Date | Time | Court | Opponent | Outcome |\n| --- | --- | --- | --- | --- |";
    return [
      `## ${leagueLabel} — ${team.division} Division — #${team.number} ${team.captain}`,
      statsLine,
      "",
      header,
      ...(rows.length > 0 ? rows : ["| _no scheduled matches_ |  |  |  |  |"]),
    ].join("\n");
  }
  const rows = teamMatches.map((m) => `  ${renderTextRow(snapshot, team, m)}`);
  return [
    `${leagueLabel} — ${team.division} Division — #${team.number} ${team.captain}`,
    statsLine,
    ...(rows.length > 0 ? rows : ["  (no scheduled matches)"]),
  ].join("\n");
}

function renderTextRow(snapshot: Snapshot, team: Team, match: Match): string {
  const opponent = findOpponent(snapshot, team, match);
  const outcome = renderOutcome(team, match);
  const outcomeTag = outcome ? ` [${outcome}]` : "";
  const opponentDivision = opponent ? ` (${opponent.division})` : "";
  const opponentLabel = opponent
    ? `#${opponent.number} ${opponent.captain}${opponentDivision}`
    : `#${opponentNumberOf(team, match)} (unknown)`;
  return `${match.date} ${formatTime(match.time)} ${match.court.padEnd(10, " ")} vs ${opponentLabel}${outcomeTag}`;
}

function renderMarkdownRow(snapshot: Snapshot, team: Team, match: Match): string {
  const opponent = findOpponent(snapshot, team, match);
  const outcome = renderOutcome(team, match) ?? "";
  const opponentLabel = opponent
    ? `#${opponent.number} ${opponent.captain} (${opponent.division})`
    : `#${opponentNumberOf(team, match)} (unknown)`;
  return `| ${match.date} | ${formatTime(match.time)} | ${match.court} | ${opponentLabel} | ${outcome} |`;
}

function findOpponent(snapshot: Snapshot, team: Team, match: Match): Team | undefined {
  const number = opponentNumberOf(team, match);
  return snapshot.teams.find((t) => t.number === number);
}

function opponentNumberOf(team: Team, match: Match): number {
  return match.teamNumbers[0] === team.number ? match.teamNumbers[1] : match.teamNumbers[0];
}

function renderOutcome(team: Team, match: Match): string | null {
  if (match.outcome.status !== "played") return null;
  const { winnerTeamNumber, setsWinner, setsLoser } = match.outcome;
  const didWin = winnerTeamNumber === team.number;
  const score = didWin ? `${setsWinner}-${setsLoser}` : `${setsLoser}-${setsWinner}`;
  return `${didWin ? "W" : "L"} ${score}`;
}

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}
