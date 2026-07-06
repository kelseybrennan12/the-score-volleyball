import type { Snapshot } from "@/shared/domain/snapshot";

export interface ArchiveEntry {
  slug: string;
  archiveKey: string;
  ingestedAt: string;
}

export interface RestoreResult {
  activePath: string;
  archivedPath: string;
}

/**
 * Outcome of freezing a league's active snapshot into a past-season archive and purging its live copies.
 * `seasonPath` is null when there was no active snapshot to promote.
 */
export interface PromoteResult {
  seasonPath: string | null;
  deletedActive: boolean;
  deletedArchiveCount: number;
}

export const DEFAULT_ARCHIVE_LIMIT = 10;

export interface SnapshotRepo {
  readActive(slug: string): Promise<Snapshot | null>;
  listActive(): Promise<Snapshot[]>;
  writeActive(snapshot: Snapshot): Promise<string>;
  archiveExisting(slug: string): Promise<string | null>;
  listArchive(slug: string, limit?: number): Promise<ArchiveEntry[]>;
  readArchive(slug: string, archiveKey: string): Promise<Snapshot>;
  restoreArchive(slug: string, archiveKey: string): Promise<RestoreResult>;
  getLastIngestedAt(): Promise<string | null>;
  setLastIngestedAt(iso: string): Promise<void>;
  // Frozen past-season archive (one immutable snapshot per league per season), distinct from rollback archive.
  listSeasonKeys(): Promise<string[]>;
  listSeasonSnapshots(seasonKey: string): Promise<Snapshot[]>;
  writeSeasonSnapshot(seasonKey: string, snapshot: Snapshot): Promise<string>;
  promoteActiveToSeason(seasonKey: string, slug: string): Promise<PromoteResult>;
}

export function toArchiveStamp(ingestedAt: string): string {
  const date = new Date(ingestedAt);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-` +
    `${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
  );
}

export function archiveFileName(slug: string, ingestedAt: string): string {
  return `${slug}-${toArchiveStamp(ingestedAt)}.json`;
}
