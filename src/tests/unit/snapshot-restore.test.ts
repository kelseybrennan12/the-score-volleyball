import { createSnapshotRepo } from "@/backend/runtime/adapters/snapshots/fs";
import type { Snapshot } from "@/shared/domain/snapshot";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function makeSnapshot(slug: string, ingestedAt: string, tag: string): Snapshot {
  return {
    schemaVersion: 1,
    league: {
      slug,
      displayName: slug,
      day: "sunday",
      session: "spring",
      year: 2026,
      sourceSheetId: "sheetid",
    },
    ingestedAt,
    teams: [{ number: 1, captain: tag, division: "B" }],
    matches: [],
  };
}

describe("snapshot fs repo — extended port", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "snap-restore-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("listArchive returns entries newest-first capped at limit", async () => {
    const repo = createSnapshotRepo(root);
    const stamps = ["2026-04-10T10:00:00Z", "2026-04-11T10:00:00Z", "2026-04-12T10:00:00Z", "2026-04-13T10:00:00Z"];
    for (const stamp of stamps) {
      await repo.writeActive(makeSnapshot("spring-sundays", stamp, stamp));
      await repo.archiveExisting("spring-sundays");
    }
    const entries = await repo.listArchive("spring-sundays", 2);
    expect(entries.map((e) => e.ingestedAt)).toEqual(["2026-04-13T10:00:00Z", "2026-04-12T10:00:00Z"]);
  });

  it("restoreArchive promotes archived snapshot and archives the prior active", async () => {
    const repo = createSnapshotRepo(root);
    const older = makeSnapshot("spring-sundays", "2026-04-12T10:00:00Z", "older");
    const newer = makeSnapshot("spring-sundays", "2026-04-19T10:00:00Z", "newer");
    await repo.writeActive(older);
    await repo.archiveExisting("spring-sundays");
    await repo.writeActive(newer);

    const archiveList = await repo.listArchive("spring-sundays");
    expect(archiveList).toHaveLength(1);
    const { archiveKey } = archiveList[0];

    const result = await repo.restoreArchive("spring-sundays", archiveKey);
    expect(result.activePath).toContain("active");
    expect(result.archivedPath).toContain("archive");

    const active = await repo.readActive("spring-sundays");
    expect(active?.teams[0].captain).toBe("older");

    const afterRestore = await repo.listArchive("spring-sundays");
    expect(afterRestore).toHaveLength(1);
    expect(afterRestore[0].ingestedAt).toBe(newer.ingestedAt);
    expect(existsSync(path.join(root, "archive", "spring-sundays", archiveKey))).toBe(false);
  });

  it("roundtrips lastIngestedAt", async () => {
    const repo = createSnapshotRepo(root);
    expect(await repo.getLastIngestedAt()).toBeNull();
    await repo.setLastIngestedAt("2026-04-19T10:00:00Z");
    expect(await repo.getLastIngestedAt()).toBe("2026-04-19T10:00:00Z");
  });
});
