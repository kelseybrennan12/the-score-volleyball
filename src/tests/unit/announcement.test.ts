import { readAnnouncement, saveAnnouncement } from "@/backend/logic/services/announcement";
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

describe("saveAnnouncement", () => {
  let root: string;
  const clock = () => new Date("2026-09-21T15:30:00.000Z");

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "announcement-save-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("saves then reads back the stored announcement", async () => {
    const repo = createAnnouncementRepo(root);
    const result = await saveAnnouncement({
      message: "Season starts Monday",
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      message: "Season starts Monday",
      enabled: true,
      version: 0,
      updatedAt: "2026-09-21T15:30:00.000Z",
    });
    expect(await readAnnouncement(repo)).toEqual(result.body);
  });

  it("increments the version on publish-as-new but not on a plain save or an enabled-only flip", async () => {
    const repo = createAnnouncementRepo(root);

    await saveAnnouncement({ message: "First", enabled: true, publishAsNew: false, repo, now: clock });
    let stored = await readAnnouncement(repo);
    expect(stored?.version).toBe(0);

    const republished = await saveAnnouncement({
      message: "Second",
      enabled: true,
      publishAsNew: true,
      repo,
      now: clock,
    });
    expect((republished.body as Announcement).version).toBe(1);

    // A plain edit keeps the version.
    const edited = await saveAnnouncement({
      message: "Second (typo fix)",
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect((edited.body as Announcement).version).toBe(1);

    // An enabled-only flip (the on/off switch) keeps the version too.
    const flipped = await saveAnnouncement({
      message: "Second (typo fix)",
      enabled: false,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect((flipped.body as Announcement).version).toBe(1);
    stored = await readAnnouncement(repo);
    expect(stored?.version).toBe(1);
  });

  it("rejects an enabled announcement with a blank or whitespace-only message", async () => {
    const repo = createAnnouncementRepo(root);

    const blank = await saveAnnouncement({ message: "", enabled: true, publishAsNew: false, repo, now: clock });
    expect(blank.status).toBe(400);
    expect(blank.body).toHaveProperty("error");

    const whitespace = await saveAnnouncement({
      message: "   \n\t ",
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect(whitespace.status).toBe(400);

    // Nothing was written.
    expect(await readAnnouncement(repo)).toBeNull();
  });

  it("accepts a disabled announcement with a blank message", async () => {
    const repo = createAnnouncementRepo(root);
    const result = await saveAnnouncement({ message: "  ", enabled: false, publishAsNew: false, repo, now: clock });
    expect(result.status).toBe(200);
    expect((result.body as Announcement).message).toBe("");
    expect((result.body as Announcement).enabled).toBe(false);
  });

  it("trims the message and rejects one over 200 characters after trimming", async () => {
    const repo = createAnnouncementRepo(root);

    const trimmed = await saveAnnouncement({
      message: "  hello  ",
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect((trimmed.body as Announcement).message).toBe("hello");

    const exactly200 = "x".repeat(200);
    const ok = await saveAnnouncement({
      message: `  ${exactly200}  `,
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect(ok.status).toBe(200);
    expect((ok.body as Announcement).message).toBe(exactly200);

    const tooLong = await saveAnnouncement({
      message: "x".repeat(201),
      enabled: true,
      publishAsNew: false,
      repo,
      now: clock,
    });
    expect(tooLong.status).toBe(400);
  });

  it("records the last-saved timestamp from the injected clock", async () => {
    const repo = createAnnouncementRepo(root);
    const result = await saveAnnouncement({
      message: "Timestamped",
      enabled: true,
      publishAsNew: false,
      repo,
      now: () => new Date("2027-01-02T03:04:05.000Z"),
    });
    expect((result.body as Announcement).updatedAt).toBe("2027-01-02T03:04:05.000Z");
  });
});
