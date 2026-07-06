import { createSnapshotRepo } from "@/backend/runtime/adapters/snapshots/fs";
import type { Snapshot } from "@/shared/domain/snapshot";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function makeSnapshot(slug: string, ingestedAt: string): Snapshot {
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day: "sunday", session: "spring", year: 2026, sourceSheetId: "sheetid" },
    ingestedAt,
    teams: [{ number: 1, captain: "A", division: "B" }],
    matches: [],
  };
}

describe("snapshot fs repo — seasons store", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "season-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes a season snapshot and lists it back by key", async () => {
    const repo = createSnapshotRepo(root);
    const snap = makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z");
    const seasonPath = await repo.writeSeasonSnapshot("spring-2026", snap);
    expect(seasonPath).toBe(path.join(root, "seasons", "spring-2026", "spring-sundays.json"));
    expect(await repo.listSeasonKeys()).toEqual(["spring-2026"]);
    expect(await repo.listSeasonSnapshots("spring-2026")).toEqual([snap]);
  });

  it("returns empty results when the seasons store does not exist", async () => {
    const repo = createSnapshotRepo(root);
    expect(await repo.listSeasonKeys()).toEqual([]);
    expect(await repo.listSeasonSnapshots("spring-2026")).toEqual([]);
  });

  it("promotes the active snapshot into the season and purges its live copies", async () => {
    const repo = createSnapshotRepo(root);
    // Two prior ingestions leave one active + two rollback archive copies.
    await repo.writeActive(makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z"));
    await repo.archiveExisting("spring-sundays");
    await repo.writeActive(makeSnapshot("spring-sundays", "2026-04-26T14:05:00Z"));
    await repo.archiveExisting("spring-sundays");
    await repo.writeActive(makeSnapshot("spring-sundays", "2026-05-03T14:05:00Z"));

    const result = await repo.promoteActiveToSeason("spring-2026", "spring-sundays");

    expect(result.deletedActive).toBe(true);
    expect(result.deletedArchiveCount).toBe(2);
    expect(result.seasonPath).toBe(path.join(root, "seasons", "spring-2026", "spring-sundays.json"));
    // The frozen season copy is the latest active snapshot.
    const frozen = await repo.listSeasonSnapshots("spring-2026");
    expect(frozen).toHaveLength(1);
    expect(frozen[0].ingestedAt).toBe("2026-05-03T14:05:00Z");
    // Live copies are gone.
    expect(await repo.readActive("spring-sundays")).toBeNull();
    expect(existsSync(path.join(root, "archive", "spring-sundays"))).toBe(false);
  });

  it("is a no-op when there is no active snapshot to promote", async () => {
    const repo = createSnapshotRepo(root);
    const result = await repo.promoteActiveToSeason("spring-2026", "missing");
    expect(result).toEqual({ seasonPath: null, deletedActive: false, deletedArchiveCount: 0 });
    expect(await repo.listSeasonKeys()).toEqual([]);
  });
});
