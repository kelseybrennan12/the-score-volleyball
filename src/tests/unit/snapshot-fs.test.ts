import { createSnapshotRepo } from "@/backend/runtime/adapters/snapshots/fs";
import type { Snapshot } from "@/shared/domain/snapshot";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function makeSnapshot(slug: string, ingestedAt: string): Snapshot {
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
    teams: [{ number: 1, captain: "A", division: "B" }],
    matches: [],
  };
}

describe("snapshot fs repo", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "snap-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes active snapshot and reads it back", async () => {
    const repo = createSnapshotRepo(root);
    const snap = makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z");
    const activePath = await repo.writeActive(snap);
    expect(activePath).toBe(path.join(root, "active", "spring-sundays.json"));
    const read = await repo.readActive("spring-sundays");
    expect(read).toEqual(snap);
  });

  it("archives the previous active snapshot before the next write", async () => {
    const repo = createSnapshotRepo(root);
    const first = makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z");
    await repo.writeActive(first);
    const archivedPath = await repo.archiveExisting("spring-sundays");
    expect(archivedPath).toBe(path.join(root, "archive", "spring-sundays", "spring-sundays-2026-04-19-14-05-00.json"));
    const second = makeSnapshot("spring-sundays", "2026-04-26T14:00:00Z");
    await repo.writeActive(second);
    const active = JSON.parse(await readFile(path.join(root, "active", "spring-sundays.json"), "utf8"));
    expect(active.ingestedAt).toBe(second.ingestedAt);
    const archiveDir = await readdir(path.join(root, "archive", "spring-sundays"));
    expect(archiveDir).toEqual(["spring-sundays-2026-04-19-14-05-00.json"]);
  });

  it("archiveExisting returns null when there is no active snapshot", async () => {
    const repo = createSnapshotRepo(root);
    expect(await repo.archiveExisting("missing")).toBeNull();
  });
});
