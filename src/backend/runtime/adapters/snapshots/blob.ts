import type { Snapshot } from "@/shared/domain/snapshot";
import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import {
  DEFAULT_ARCHIVE_LIMIT,
  archiveFileName,
  type ArchiveEntry,
  type RestoreResult,
  type SnapshotRepo,
} from "./port";

const ACTIVE_PREFIX = "snapshots/active/";
const ARCHIVE_PREFIX = "snapshots/archive/";
const META_PATH = "snapshots/meta.json";
const ACCESS = "private" as const;

export interface BlobRepoOptions {
  token: string;
}

export function createBlobSnapshotRepo({ token }: BlobRepoOptions): SnapshotRepo {
  const writeOpts = {
    access: ACCESS,
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  };

  async function readJson<T>(pathname: string): Promise<T | null> {
    let result;
    try {
      result = await get(pathname, { access: ACCESS, token, useCache: false });
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const raw = await new Response(result.stream).text();
    return JSON.parse(raw) as T;
  }

  async function writeJson(pathname: string, body: unknown): Promise<string> {
    const payload = JSON.stringify(body, null, 2) + "\n";
    const result = await put(pathname, payload, writeOpts);
    return result.pathname;
  }

  async function readActive(slug: string): Promise<Snapshot | null> {
    return readJson<Snapshot>(`${ACTIVE_PREFIX}${slug}.json`);
  }

  async function listActive(): Promise<Snapshot[]> {
    const snapshots: Snapshot[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: ACTIVE_PREFIX, token, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (!blob.pathname.endsWith(".json")) continue;
        const snapshot = await readJson<Snapshot>(blob.pathname);
        if (snapshot) snapshots.push(snapshot);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return snapshots;
  }

  async function archiveExisting(slug: string): Promise<string | null> {
    const activePath = `${ACTIVE_PREFIX}${slug}.json`;
    const current = await readJson<Snapshot>(activePath);
    if (!current) return null;
    const archivePath = `${ARCHIVE_PREFIX}${slug}/${archiveFileName(slug, current.ingestedAt)}`;
    const stored = await writeJson(archivePath, current);
    await del(activePath, { token });
    return stored;
  }

  async function writeActive(snapshot: Snapshot): Promise<string> {
    return writeJson(`${ACTIVE_PREFIX}${snapshot.league.slug}.json`, snapshot);
  }

  async function listArchive(slug: string, limit: number = DEFAULT_ARCHIVE_LIMIT): Promise<ArchiveEntry[]> {
    const prefix = `${ARCHIVE_PREFIX}${slug}/`;
    const entries: ArchiveEntry[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, token, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (!blob.pathname.endsWith(".json")) continue;
        const archiveKey = blob.pathname.slice(prefix.length);
        const ingestedAt = ingestedAtFromArchiveKey(slug, archiveKey);
        if (!ingestedAt) continue;
        entries.push({ slug, archiveKey, ingestedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    entries.sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
    return entries.slice(0, limit);
  }

  async function readArchive(slug: string, archiveKey: string): Promise<Snapshot> {
    const pathname = `${ARCHIVE_PREFIX}${slug}/${archiveKey}`;
    const snapshot = await readJson<Snapshot>(pathname);
    if (!snapshot) throw new Error(`Archive not found: ${pathname}`);
    return snapshot;
  }

  async function restoreArchive(slug: string, archiveKey: string): Promise<RestoreResult> {
    const sourcePath = `${ARCHIVE_PREFIX}${slug}/${archiveKey}`;
    const archivedSnapshot = await readArchive(slug, archiveKey);
    const archivedPath = (await archiveExisting(slug)) ?? "";
    const activePath = await writeActive(archivedSnapshot);
    await del(sourcePath, { token });
    return { activePath, archivedPath };
  }

  async function getLastIngestedAt(): Promise<string | null> {
    const meta = await readJson<{ lastIngestedAt?: string }>(META_PATH);
    return meta?.lastIngestedAt ?? null;
  }

  async function setLastIngestedAt(iso: string): Promise<void> {
    await writeJson(META_PATH, { lastIngestedAt: iso });
  }

  return {
    readActive,
    listActive,
    writeActive,
    archiveExisting,
    listArchive,
    readArchive,
    restoreArchive,
    getLastIngestedAt,
    setLastIngestedAt,
  };
}

function isNotFound(err: unknown): boolean {
  if (err instanceof BlobNotFoundError) return true;
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.includes("does not exist");
}

function ingestedAtFromArchiveKey(slug: string, archiveKey: string): string | null {
  const prefix = `${slug}-`;
  if (!archiveKey.startsWith(prefix) || !archiveKey.endsWith(".json")) return null;
  const stamp = archiveKey.slice(prefix.length, -".json".length);
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(stamp);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}
