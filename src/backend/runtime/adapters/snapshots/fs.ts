import type { Snapshot } from "@/shared/domain/snapshot";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SnapshotRepo {
  readActive(slug: string): Promise<Snapshot | null>;
  listActive(): Promise<Snapshot[]>;
  writeActive(snapshot: Snapshot): Promise<string>;
  archiveExisting(slug: string): Promise<string | null>;
}

export function createSnapshotRepo(root: string): SnapshotRepo {
  const activeDir = path.join(root, "active");
  const archiveRoot = path.join(root, "archive");

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
    const stamp = toArchiveStamp(current.ingestedAt);
    const archiveDir = path.join(archiveRoot, slug);
    await mkdir(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, `${slug}-${stamp}.json`);
    await rename(activePath, archivePath);
    return archivePath;
  }

  async function writeActive(snapshot: Snapshot): Promise<string> {
    await mkdir(activeDir, { recursive: true });
    const filePath = path.join(activeDir, `${snapshot.league.slug}.json`);
    await writeFile(filePath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    return filePath;
  }

  return { readActive, listActive, writeActive, archiveExisting };
}

function toArchiveStamp(ingestedAt: string): string {
  const date = new Date(ingestedAt);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-` +
    `${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
  );
}
