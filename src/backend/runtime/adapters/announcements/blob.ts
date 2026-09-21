import type { Announcement } from "@/shared/domain/announcement";
import { get, put } from "@vercel/blob";
import { isBlobNotFound } from "../storage-backend";
import type { AnnouncementRepo } from "./port";

// Beside the snapshots in the existing private store.
const ANNOUNCEMENT_PATH = "announcement.json";
const ACCESS = "private" as const;

export interface BlobRepoOptions {
  token: string;
}

export function createAnnouncementBlobRepo({ token }: BlobRepoOptions): AnnouncementRepo {
  async function read(): Promise<Announcement | null> {
    let result;
    try {
      result = await get(ANNOUNCEMENT_PATH, { access: ACCESS, token, useCache: false });
    } catch (err) {
      if (isBlobNotFound(err)) return null;
      throw err;
    }
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const raw = await new Response(result.stream).text();
    return JSON.parse(raw) as Announcement;
  }

  async function write(announcement: Announcement): Promise<void> {
    await put(ANNOUNCEMENT_PATH, JSON.stringify(announcement, null, 2) + "\n", {
      access: ACCESS,
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  }

  return { read, write };
}
