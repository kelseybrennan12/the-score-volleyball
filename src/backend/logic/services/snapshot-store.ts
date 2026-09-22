import type { ObjectStore } from "@/backend/runtime/adapters/object-store/port";
import type { Snapshot } from "@/shared/domain/snapshot";

export interface ArchiveEntry {
  slug: string;
  archiveKey: string;
  ingestedAt: string;
}

export interface RestoreResult {
  /** Key of the restored snapshot. */
  activePath: string;
  /** Key the previously-live snapshot was archived under, or null when there was none. */
  archivedPath: string | null;
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

const DEFAULT_ARCHIVE_LIMIT = 10;

/**
 * Every snapshot of every league: the live snapshot per league, its rollback archive, the frozen season archive, and
 * the last-ingested stamp. One implementation over the object store seam; the layout and every multi-step operation
 * live here, so a filesystem, Blob, or memory backend only has to store JSON by key.
 */
export interface SnapshotStore {
  readActive(slug: string): Promise<Snapshot | null>;
  listActive(): Promise<Snapshot[]>;
  /** Returns the key the snapshot was written under. */
  writeActive(snapshot: Snapshot): Promise<string>;
  /** Moves the active snapshot into the rollback archive under its ingestion stamp; null when there is none. */
  archiveExisting(slug: string): Promise<string | null>;
  /** Rollback archive entries newest-first, capped at `limit`. */
  listArchive(slug: string, limit?: number): Promise<ArchiveEntry[]>;
  readArchive(slug: string, archiveKey: string): Promise<Snapshot>;
  /** Makes an archived snapshot the live one again, archiving the current live snapshot in its place. Not atomic. */
  restoreArchive(slug: string, archiveKey: string): Promise<RestoreResult>;
  getLastIngestedAt(): Promise<string | null>;
  setLastIngestedAt(iso: string): Promise<void>;
  /** Frozen season archive: one immutable snapshot per league per season, distinct from the rollback archive. */
  listSeasonKeys(): Promise<string[]>;
  listSeasonSnapshots(seasonKey: string): Promise<Snapshot[]>;
  writeSeasonSnapshot(seasonKey: string, snapshot: Snapshot): Promise<string>;
  /** Freezes a retired league: copies active into the season, then deletes active and its rollback archive. Not atomic. */
  promoteActiveToSeason(seasonKey: string, slug: string): Promise<PromoteResult>;
}

const ACTIVE_PREFIX = "snapshots/active/";
const ARCHIVE_PREFIX = "snapshots/archive/";
const SEASONS_PREFIX = "snapshots/seasons/";
const META_KEY = "snapshots/meta.json";

const activeKey = (slug: string) => `${ACTIVE_PREFIX}${slug}.json`;
const archivePrefix = (slug: string) => `${ARCHIVE_PREFIX}${slug}/`;
const archiveKeyFor = (slug: string, archiveKey: string) => `${archivePrefix(slug)}${archiveKey}`;
const seasonPrefix = (seasonKey: string) => `${SEASONS_PREFIX}${seasonKey}/`;
const seasonKeyFor = (seasonKey: string, slug: string) => `${seasonPrefix(seasonKey)}${slug}.json`;

function toArchiveStamp(ingestedAt: string): string {
  const date = new Date(ingestedAt);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-` +
    `${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
  );
}

function archiveFileName(slug: string, ingestedAt: string): string {
  return `${slug}-${toArchiveStamp(ingestedAt)}.json`;
}

/** The ingestion instant encoded in an archive file name, or null when the name is not one this store wrote. */
function ingestedAtFromArchiveKey(slug: string, archiveKey: string): string | null {
  const prefix = `${slug}-`;
  if (!archiveKey.startsWith(prefix) || !archiveKey.endsWith(".json")) return null;
  const stamp = archiveKey.slice(prefix.length, -".json".length);
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(stamp);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

export function createSnapshotStore(objects: ObjectStore): SnapshotStore {
  async function readAll(prefix: string): Promise<Snapshot[]> {
    const keys = (await objects.list(prefix)).filter((k) => k.endsWith(".json"));
    const snapshots: Snapshot[] = [];
    for (const key of keys) {
      const snapshot = await objects.get<Snapshot>(key);
      if (snapshot) snapshots.push(snapshot);
    }
    return snapshots;
  }

  async function readActive(slug: string): Promise<Snapshot | null> {
    return objects.get<Snapshot>(activeKey(slug));
  }

  async function writeActive(snapshot: Snapshot): Promise<string> {
    const key = activeKey(snapshot.league.slug);
    await objects.put(key, snapshot);
    return key;
  }

  async function archiveExisting(slug: string): Promise<string | null> {
    const current = await readActive(slug);
    if (!current) return null;
    const key = archiveKeyFor(slug, archiveFileName(slug, current.ingestedAt));
    await objects.put(key, current);
    await objects.delete([activeKey(slug)]);
    return key;
  }

  async function listArchive(slug: string, limit: number = DEFAULT_ARCHIVE_LIMIT): Promise<ArchiveEntry[]> {
    const prefix = archivePrefix(slug);
    const entries: ArchiveEntry[] = [];
    for (const key of await objects.list(prefix)) {
      const archiveKey = key.slice(prefix.length);
      const ingestedAt = ingestedAtFromArchiveKey(slug, archiveKey);
      if (ingestedAt) entries.push({ slug, archiveKey, ingestedAt });
    }
    entries.sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
    return entries.slice(0, limit);
  }

  async function readArchive(slug: string, archiveKey: string): Promise<Snapshot> {
    const key = archiveKeyFor(slug, archiveKey);
    const snapshot = await objects.get<Snapshot>(key);
    if (!snapshot) throw new Error(`Archive not found: ${key}`);
    return snapshot;
  }

  async function restoreArchive(slug: string, archiveKey: string): Promise<RestoreResult> {
    const archivedSnapshot = await readArchive(slug, archiveKey);
    const archivedPath = await archiveExisting(slug);
    const activePath = await writeActive(archivedSnapshot);
    await objects.delete([archiveKeyFor(slug, archiveKey)]);
    return { activePath, archivedPath };
  }

  async function listSeasonKeys(): Promise<string[]> {
    const keys = new Set<string>();
    for (const key of await objects.list(SEASONS_PREFIX)) {
      const rest = key.slice(SEASONS_PREFIX.length);
      const slash = rest.indexOf("/");
      if (slash > 0) keys.add(rest.slice(0, slash));
    }
    return [...keys].sort();
  }

  async function writeSeasonSnapshot(seasonKey: string, snapshot: Snapshot): Promise<string> {
    const key = seasonKeyFor(seasonKey, snapshot.league.slug);
    await objects.put(key, snapshot);
    return key;
  }

  async function promoteActiveToSeason(seasonKey: string, slug: string): Promise<PromoteResult> {
    const active = await readActive(slug);
    if (!active) return { seasonPath: null, deletedActive: false, deletedArchiveCount: 0 };
    const seasonPath = await writeSeasonSnapshot(seasonKey, active);
    await objects.delete([activeKey(slug)]);
    const archived = await objects.list(archivePrefix(slug));
    await objects.delete(archived);
    return { seasonPath, deletedActive: true, deletedArchiveCount: archived.length };
  }

  return {
    readActive,
    listActive: () => readAll(ACTIVE_PREFIX),
    writeActive,
    archiveExisting,
    listArchive,
    readArchive,
    restoreArchive,
    async getLastIngestedAt() {
      // A corrupt stamp reads as "never ingested" so the next successful run rewrites it, rather than blocking ingestion.
      try {
        const meta = await objects.get<{ lastIngestedAt?: string }>(META_KEY);
        return meta?.lastIngestedAt ?? null;
      } catch {
        return null;
      }
    },
    setLastIngestedAt: (iso) => objects.put(META_KEY, { lastIngestedAt: iso }),
    listSeasonKeys,
    listSeasonSnapshots: (seasonKey) => readAll(seasonPrefix(seasonKey)),
    writeSeasonSnapshot,
    promoteActiveToSeason,
  };
}
