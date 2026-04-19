import type { Snapshot } from "./snapshot";

export function pickCurrentSnapshot(snapshots: Snapshot[], todayIso: string): Snapshot | null {
  if (snapshots.length === 0) return null;
  if (snapshots.length === 1) return snapshots[0];
  const ranges = snapshots.map((snapshot) => {
    const dates = snapshot.matches.map((m) => m.date).sort();
    return {
      snapshot,
      earliest: dates[0] ?? null,
      latest: dates[dates.length - 1] ?? null,
    };
  });
  const inFlight = ranges.find((r) => r.earliest && r.latest && r.earliest <= todayIso && todayIso <= r.latest);
  if (inFlight) return inFlight.snapshot;
  const upcoming = ranges
    .filter((r): r is typeof r & { earliest: string } => r.earliest != null && r.earliest > todayIso)
    .sort((a, b) => (a.earliest < b.earliest ? -1 : 1));
  if (upcoming[0]) return upcoming[0].snapshot;
  const past = ranges
    .filter((r): r is typeof r & { latest: string } => r.latest != null && r.latest < todayIso)
    .sort((a, b) => (a.latest > b.latest ? -1 : 1));
  if (past[0]) return past[0].snapshot;
  return snapshots[0];
}
