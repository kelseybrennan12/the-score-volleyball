import type { Snapshot, Team } from "./snapshot";

export function findTeamCandidates(snapshot: Snapshot, query: string): Team[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const asNumber = Number.parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed) && Number.isFinite(asNumber)) {
    const exact = snapshot.teams.find((t) => t.number === asNumber);
    return exact ? [exact] : [];
  }
  const lower = trimmed.toLowerCase();
  return snapshot.teams.filter((t) => t.captain.toLowerCase().includes(lower));
}

export function findTeamByNumber(snapshot: Snapshot, teamNumber: number): Team | null {
  return snapshot.teams.find((t) => t.number === teamNumber) ?? null;
}
