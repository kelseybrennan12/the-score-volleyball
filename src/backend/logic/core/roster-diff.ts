import type { Team } from "@/shared/domain/snapshot";

export type RosterDiff = "same" | "changed";

export function diffRoster(prev: Team[] | null, next: Team[]): RosterDiff {
  if (!prev) return "same";
  if (prev.length !== next.length) return "changed";
  const prevKey = rosterKey(prev);
  const nextKey = rosterKey(next);
  return prevKey === nextKey ? "same" : "changed";
}

function rosterKey(teams: Team[]): string {
  return [...teams]
    .map((t) => `${t.number}:${t.captain.toLowerCase()}`)
    .sort()
    .join("|");
}
