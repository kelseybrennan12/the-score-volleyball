import type { Snapshot } from "@/shared/domain/snapshot";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ARCHIVE_LIMIT,
  archiveFileName,
  type ArchiveEntry,
  type RestoreResult,
  type SnapshotRepo,
} from "./port";

export type { SnapshotRepo } from "./port";

export function createSnapshotRepo(root: string): SnapshotRepo {
  const activeDir = path.join(root, "active");
  const archiveRoot = path.join(root, "archive");
  const metaPath = path.join(root, "meta.json");

  async function readActive(slug: string): Promise<Snapshot | null> {
    const filePath = path.join(activeDir, `${slug}.json`);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Snapshot;
  }

  async function listActive(): Promise<Snapshot[]> {
    if (!existsSync(activeDir)) return [];
    const names = await readdir(activeDir);
    const snapshots: Snapshot[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(path.join(activeDir, name), "utf8");
      snapshots.push(JSON.parse(raw) as Snapshot);
    }
    return snapshots;
  }

  async function archiveExisting(slug: string): Promise<string | null> {
    const activePath = path.join(activeDir, `${slug}.json`);
    if (!existsSync(activePath)) return null;
    const current = JSON.parse(await readFile(activePath, "utf8")) as Snapshot;
    const archiveDir = path.join(archiveRoot, slug);
    await mkdir(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, archiveFileName(slug, current.ingestedAt));
    await rename(activePath, archivePath);
    return archivePath;
  }

  async function writeActive(snapshot: Snapshot): Promise<string> {
    await mkdir(activeDir, { recursive: true });
    const filePath = path.join(activeDir, `${snapshot.league.slug}.json`);
    await writeFile(filePath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    return filePath;
  }

  async function listArchive(slug: string, limit: number = DEFAULT_ARCHIVE_LIMIT): Promise<ArchiveEntry[]> {
    const archiveDir = path.join(archiveRoot, slug);
    if (!existsSync(archiveDir)) return [];
    const names = await readdir(archiveDir);
    const entries: ArchiveEntry[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(path.join(archiveDir, name), "utf8");
      const snapshot = JSON.parse(raw) as Snapshot;
      entries.push({ slug, archiveKey: name, ingestedAt: snapshot.ingestedAt });
    }
    entries.sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
    return entries.slice(0, limit);
  }

  async function readArchive(slug: string, archiveKey: string): Promise<Snapshot> {
    const filePath = path.join(archiveRoot, slug, archiveKey);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Snapshot;
  }

  async function restoreArchive(slug: string, archiveKey: string): Promise<RestoreResult> {
    const sourcePath = path.join(archiveRoot, slug, archiveKey);
    const archivedSnapshot = JSON.parse(await readFile(sourcePath, "utf8")) as Snapshot;
    const archivedPath = (await archiveExisting(slug)) ?? "";
    const activePath = await writeActive(archivedSnapshot);
    await rm(sourcePath, { force: true });
    return { activePath, archivedPath };
  }

  async function getLastIngestedAt(): Promise<string | null> {
    if (!existsSync(metaPath)) return null;
    const raw = await readFile(metaPath, "utf8");
    try {
      const parsed = JSON.parse(raw) as { lastIngestedAt?: string };
      return parsed.lastIngestedAt ?? null;
    } catch {
      return null;
    }
  }

  async function setLastIngestedAt(iso: string): Promise<void> {
    await mkdir(root, { recursive: true });
    await writeFile(metaPath, JSON.stringify({ lastIngestedAt: iso }, null, 2) + "\n", "utf8");
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
