import path from "node:path";
import { createBlobSnapshotRepo } from "./blob";
import { createSnapshotRepo } from "./fs";
import type { SnapshotRepo } from "./port";

export { createBlobSnapshotRepo } from "./blob";
export { createSnapshotRepo } from "./fs";
export { archiveFileName, DEFAULT_ARCHIVE_LIMIT, toArchiveStamp } from "./port";
export type { ArchiveEntry, RestoreResult, SnapshotRepo } from "./port";

export interface ResolveRepoOptions {
  cwd?: string;
}

export function resolveSnapshotRepo(options: ResolveRepoOptions = {}): SnapshotRepo {
  const backend = snapshotBackend();
  if (backend === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required when SNAPSHOT_STORAGE=blob (or running on Vercel).");
    }
    return createBlobSnapshotRepo({ token });
  }
  const root = path.resolve(options.cwd ?? process.cwd(), "data/snapshots");
  return createSnapshotRepo(root);
}

function snapshotBackend(): "fs" | "blob" {
  const explicit = process.env.SNAPSHOT_STORAGE?.toLowerCase();
  if (explicit === "fs" || explicit === "blob") return explicit;
  if (process.env.VERCEL === "1") return "blob";
  return "fs";
}
