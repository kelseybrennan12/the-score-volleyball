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
