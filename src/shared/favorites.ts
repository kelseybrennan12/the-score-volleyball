export type FavoriteTeams = ReadonlySet<string>;

export function parseFavoriteTeams(raw: string | undefined): FavoriteTeams {
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const piece of raw.split(",")) {
    const trimmed = piece.trim().toLowerCase();
    if (/^[a-z]+:\d+$/.test(trimmed)) out.add(trimmed);
  }
  return out;
}

export function isFavoriteTeam(favorites: FavoriteTeams, day: string, teamNumber: number): boolean {
  return favorites.has(`${day.toLowerCase()}:${teamNumber}`);
}
