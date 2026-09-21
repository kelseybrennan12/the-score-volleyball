import path from "node:path";
import { requireBlobToken, resolveStorageBackend } from "../storage-backend";
import { createAnnouncementBlobRepo } from "./blob";
import { createAnnouncementRepo } from "./fs";
import type { AnnouncementRepo } from "./port";

export { createAnnouncementBlobRepo } from "./blob";
export { createAnnouncementRepo } from "./fs";
export type { AnnouncementRepo } from "./port";

export interface ResolveRepoOptions {
  cwd?: string;
}

export function resolveAnnouncementRepo(options: ResolveRepoOptions = {}): AnnouncementRepo {
  if (resolveStorageBackend() === "blob") {
    return createAnnouncementBlobRepo({ token: requireBlobToken() });
  }
  const root = path.resolve(options.cwd ?? process.cwd(), "data/announcement");
  return createAnnouncementRepo(root);
}
