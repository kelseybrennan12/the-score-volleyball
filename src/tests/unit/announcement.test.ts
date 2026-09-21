import { readAnnouncement } from "@/backend/logic/services/announcement";
import { createAnnouncementRepo } from "@/backend/runtime/adapters/announcements/fs";
import type { Announcement } from "@/shared/domain/announcement";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("readAnnouncement", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "announcement-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns nothing when nothing is stored", async () => {
    const repo = createAnnouncementRepo(root);
    expect(await readAnnouncement(repo)).toBeNull();
  });

  it("round-trips a stored announcement", async () => {
    const repo = createAnnouncementRepo(root);
    const announcement: Announcement = {
      message: "Fall 2026 schedules are here!",
      enabled: true,
      version: 3,
      updatedAt: "2026-09-21T12:00:00.000Z",
    };
    await repo.write(announcement);
    expect(await readAnnouncement(repo)).toEqual(announcement);
  });

  it("returns nothing without throwing when the stored file is corrupt", async () => {
    const repo = createAnnouncementRepo(root);
    await writeFile(path.join(root, "announcement.json"), "{ not valid json", "utf8");
    expect(await readAnnouncement(repo)).toBeNull();
  });
});
