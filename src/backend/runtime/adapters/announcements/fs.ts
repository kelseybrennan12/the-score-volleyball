import type { Announcement } from "@/shared/domain/announcement";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnnouncementRepo } from "./port";

export type { AnnouncementRepo } from "./port";

export function createAnnouncementRepo(root: string): AnnouncementRepo {
  const filePath = path.join(root, "announcement.json");

  async function read(): Promise<Announcement | null> {
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Announcement;
  }

  async function write(announcement: Announcement): Promise<void> {
    await mkdir(root, { recursive: true });
    await writeFile(filePath, JSON.stringify(announcement, null, 2) + "\n", "utf8");
  }

  return { read, write };
}
