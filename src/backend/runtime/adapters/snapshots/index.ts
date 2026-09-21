import path from "node:path";
import { requireBlobToken, resolveStorageBackend } from "../storage-backend";
import { createBlobSnapshotRepo } from "./blob";
import { createSnapshotRepo } from "./fs";
import type { SnapshotRepo } from "./port";

export { createBlobSnapshotRepo } from "./blob";
export { createSnapshotRepo } from "./fs";
export { archiveFileName, DEFAULT_ARCHIVE_LIMIT, toArchiveStamp } from "./port";
export type { ArchiveEntry, PromoteResult, RestoreResult, SnapshotRepo } from "./port";

export interface ResolveRepoOptions {
  cwd?: string;
}

export function resolveSnapshotRepo(options: ResolveRepoOptions = {}): SnapshotRepo {
  if (resolveStorageBackend() === "blob") {
    return createBlobSnapshotRepo({ token: requireBlobToken() });
  }
  const root = path.resolve(options.cwd ?? process.cwd(), "data/snapshots");
  return createSnapshotRepo(root);
}
