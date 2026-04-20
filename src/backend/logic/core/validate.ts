import type { Match, Team } from "@/shared/domain/snapshot";

export interface ValidateInput {
  teams: Team[];
  matches: Match[];
}

export function validateSnapshot(input: ValidateInput): string[] {
  const anomalies: string[] = [];
  anomalies.push(...checkMatchIntegrity(input.matches, new Set(input.teams.map((t) => t.number))));
  anomalies.push(...checkSlotUniqueness(input.matches));
  anomalies.push(...checkPerTeamSlotUniqueness(input.matches));
  anomalies.push(...checkWinnerFirst(input.matches));
  anomalies.push(...checkPerTeamCountUniformity(input.teams, input.matches));
  return anomalies;
}

function checkMatchIntegrity(matches: Match[], knownNumbers: Set<number>): string[] {
  const out: string[] = [];
  for (const m of matches) {
    const [a, b] = m.teamNumbers;
    if (a === b) {
      out.push(`Match ${describeSlot(m)} pairs team ${a} against itself`);
    }
    if (!knownNumbers.has(a)) {
      out.push(`Match ${describeSlot(m)} references unknown team ${a}`);
    }
    if (!knownNumbers.has(b)) {
      out.push(`Match ${describeSlot(m)} references unknown team ${b}`);
    }
    if (m.outcome.status === "played") {
      const { setsWinner, setsLoser } = m.outcome;
      if (!(setsWinner === 2 || setsWinner === 3) || setsLoser < 0 || setsLoser >= setsWinner) {
        out.push(`Match ${describeSlot(m)} has nonsense set score (winner=${setsWinner}, loser=${setsLoser})`);
      }
    }
  }
  return out;
}

function checkSlotUniqueness(matches: Match[]): string[] {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const key = `${m.date} ${m.time} ${m.court}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const [key, n] of counts) {
    if (n > 1) out.push(`Slot ${key} has ${n} matches`);
  }
  return out;
}

function checkPerTeamSlotUniqueness(matches: Match[]): string[] {
  const perTeamTime = new Map<string, number>();
  for (const m of matches) {
    for (const team of m.teamNumbers) {
      const key = `${team}|${m.date}|${m.time}`;
      perTeamTime.set(key, (perTeamTime.get(key) ?? 0) + 1);
    }
  }
  const out: string[] = [];
  for (const [key, n] of perTeamTime) {
    if (n > 1) {
      const [team, date, time] = key.split("|");
      out.push(`Team ${team} is scheduled in multiple simultaneous matches on ${date} at ${time}`);
    }
  }
  return out;
}

function checkWinnerFirst(matches: Match[]): string[] {
  const out: string[] = [];
  for (const m of matches) {
    if (m.outcome.status !== "played") continue;
    if (m.outcome.winnerTeamNumber !== m.teamNumbers[0]) {
      out.push(
        `Match ${describeSlot(m)} has winner ${m.outcome.winnerTeamNumber} but ${m.teamNumbers[0]} is listed first`,
      );
    }
  }
  return out;
}

function checkPerTeamCountUniformity(teams: Team[], matches: Match[]): string[] {
  const countsByTeam = new Map<number, number>();
  for (const t of teams) countsByTeam.set(t.number, 0);
  for (const m of matches) {
    for (const n of m.teamNumbers) {
      if (countsByTeam.has(n)) countsByTeam.set(n, (countsByTeam.get(n) ?? 0) + 1);
    }
  }
  const teamsByDivision = new Map<string, Team[]>();
  for (const t of teams) {
    const list = teamsByDivision.get(t.division) ?? [];
    list.push(t);
    teamsByDivision.set(t.division, list);
  }
  const out: string[] = [];
  for (const [division, divisionTeams] of teamsByDivision) {
    const counts = divisionTeams.map((t) => countsByTeam.get(t.number) ?? 0);
    const mode = modalValue(counts);
    if (mode == null) continue;
    for (const t of divisionTeams) {
      const n = countsByTeam.get(t.number) ?? 0;
      if (Math.abs(n - mode) > 1) {
        out.push(`Team ${t.number} has ${n} scheduled matches; ${division} divisional mode is ${mode}`);
      }
    }
  }
  return out;
}

function modalValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestFreq = -1;
  for (const [v, f] of counts) {
    if (f > bestFreq || (f === bestFreq && best != null && v < best)) {
      best = v;
      bestFreq = f;
    }
  }
  return best;
}

function describeSlot(m: Match): string {
  return `${m.date} ${m.time} ${m.court}`;
}
