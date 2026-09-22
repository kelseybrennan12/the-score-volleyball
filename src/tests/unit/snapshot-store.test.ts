import { createSnapshotStore, type SnapshotStore } from "@/backend/logic/services/snapshot-store";
import { createMemoryObjectStore } from "@/backend/runtime/adapters/object-store/memory";
import type { ObjectStore } from "@/backend/runtime/adapters/object-store/port";
import type { Snapshot } from "@/shared/domain/snapshot";
import { beforeEach, describe, expect, it } from "vitest";

function makeSnapshot(slug: string, ingestedAt: string, tag = "A"): Snapshot {
  return {
    schemaVersion: 1,
    league: { slug, displayName: slug, day: "sunday", session: "spring", year: 2026, sourceSheetId: "sheetid" },
    ingestedAt,
    teams: [{ number: 1, captain: tag, division: "B" }],
    matches: [],
  };
}

describe("Snapshot store", () => {
  let objects: ObjectStore;
  let store: SnapshotStore;

  beforeEach(() => {
    objects = createMemoryObjectStore();
    store = createSnapshotStore(objects);
  });

  describe("active snapshots", () => {
    it("writes the active snapshot under its slug and reads it back", async () => {
      const snap = makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z");
      expect(await store.writeActive(snap)).toBe("snapshots/active/spring-sundays.json");
      expect(await store.readActive("spring-sundays")).toEqual(snap);
      expect(await store.readActive("missing")).toBeNull();
    });

    it("lists every active snapshot", async () => {
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z"));
      await store.writeActive(makeSnapshot("spring-mondays", "2026-04-19T14:05:00Z"));
      expect((await store.listActive()).map((s) => s.league.slug).sort()).toEqual(["spring-mondays", "spring-sundays"]);
    });
  });

  describe("rollback archive", () => {
    it("moves the active snapshot into the archive under its ingestion stamp", async () => {
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z"));
      expect(await store.archiveExisting("spring-sundays")).toBe(
        "snapshots/archive/spring-sundays/spring-sundays-2026-04-19-14-05-00.json",
      );
      expect(await store.readActive("spring-sundays")).toBeNull();
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-26T14:00:00Z"));
      expect((await store.readActive("spring-sundays"))?.ingestedAt).toBe("2026-04-26T14:00:00Z");
      expect(await objects.list("snapshots/archive/spring-sundays/")).toEqual([
        "snapshots/archive/spring-sundays/spring-sundays-2026-04-19-14-05-00.json",
      ]);
    });

    it("archiveExisting returns null when there is no active snapshot", async () => {
      expect(await store.archiveExisting("missing")).toBeNull();
    });

    it("lists archive entries newest-first, capped at the limit, with ingestedAt read from the key stamp", async () => {
      const stamps = ["2026-04-10T10:00:00Z", "2026-04-11T10:00:00Z", "2026-04-12T10:00:00Z", "2026-04-13T10:00:00Z"];
      for (const stamp of stamps) {
        await store.writeActive(makeSnapshot("spring-sundays", stamp, stamp));
        await store.archiveExisting("spring-sundays");
      }
      const entries = await store.listArchive("spring-sundays", 2);
      expect(entries).toEqual([
        {
          slug: "spring-sundays",
          archiveKey: "spring-sundays-2026-04-13-10-00-00.json",
          ingestedAt: "2026-04-13T10:00:00Z",
        },
        {
          slug: "spring-sundays",
          archiveKey: "spring-sundays-2026-04-12-10-00-00.json",
          ingestedAt: "2026-04-12T10:00:00Z",
        },
      ]);
      expect(await store.listArchive("spring-sundays")).toHaveLength(4);
    });

    it("ignores archive objects whose key does not carry a stamp", async () => {
      await objects.put("snapshots/archive/spring-sundays/notes.json", {});
      await objects.put("snapshots/archive/spring-sundays/spring-sundays-2026-04-13-10-00-00.json", {});
      expect((await store.listArchive("spring-sundays")).map((e) => e.archiveKey)).toEqual([
        "spring-sundays-2026-04-13-10-00-00.json",
      ]);
    });

    it("reads an archived snapshot by key and fails clearly when it is missing", async () => {
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-12T10:00:00Z", "older"));
      await store.archiveExisting("spring-sundays");
      const read = await store.readArchive("spring-sundays", "spring-sundays-2026-04-12-10-00-00.json");
      expect(read.teams[0].captain).toBe("older");
      await expect(store.readArchive("spring-sundays", "spring-sundays-2000-01-01-00-00-00.json")).rejects.toThrow(
        /Archive not found/,
      );
    });

    it("restores an archived snapshot to active and archives the prior active in its place", async () => {
      const older = makeSnapshot("spring-sundays", "2026-04-12T10:00:00Z", "older");
      const newer = makeSnapshot("spring-sundays", "2026-04-19T10:00:00Z", "newer");
      await store.writeActive(older);
      await store.archiveExisting("spring-sundays");
      await store.writeActive(newer);
      const [{ archiveKey }] = await store.listArchive("spring-sundays");

      const result = await store.restoreArchive("spring-sundays", archiveKey);
      expect(result).toEqual({
        activePath: "snapshots/active/spring-sundays.json",
        archivedPath: "snapshots/archive/spring-sundays/spring-sundays-2026-04-19-10-00-00.json",
      });
      expect((await store.readActive("spring-sundays"))?.teams[0].captain).toBe("older");
      const afterRestore = await store.listArchive("spring-sundays");
      expect(afterRestore.map((e) => e.ingestedAt)).toEqual([newer.ingestedAt]);
    });
  });

  describe("last-ingested stamp", () => {
    it("round-trips lastIngestedAt and reads null before the first ingestion", async () => {
      expect(await store.getLastIngestedAt()).toBeNull();
      await store.setLastIngestedAt("2026-04-19T10:00:00Z");
      expect(await store.getLastIngestedAt()).toBe("2026-04-19T10:00:00Z");
    });
  });

  describe("season archive", () => {
    it("writes a season snapshot and lists it back by season key", async () => {
      const snap = makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z");
      expect(await store.writeSeasonSnapshot("spring-2026", snap)).toBe(
        "snapshots/seasons/spring-2026/spring-sundays.json",
      );
      expect(await store.listSeasonKeys()).toEqual(["spring-2026"]);
      expect(await store.listSeasonSnapshots("spring-2026")).toEqual([snap]);
    });

    it("lists each season key once and reads empty when nothing is frozen", async () => {
      expect(await store.listSeasonKeys()).toEqual([]);
      expect(await store.listSeasonSnapshots("spring-2026")).toEqual([]);
      await store.writeSeasonSnapshot("spring-2026", makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z"));
      await store.writeSeasonSnapshot("spring-2026", makeSnapshot("spring-mondays", "2026-04-19T14:05:00Z"));
      await store.writeSeasonSnapshot("summer-2026", makeSnapshot("summer-sundays", "2026-07-19T14:05:00Z"));
      expect(await store.listSeasonKeys()).toEqual(["spring-2026", "summer-2026"]);
    });

    it("promotes the active snapshot into the season and purges its live copies", async () => {
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-19T14:05:00Z"));
      await store.archiveExisting("spring-sundays");
      await store.writeActive(makeSnapshot("spring-sundays", "2026-04-26T14:05:00Z"));
      await store.archiveExisting("spring-sundays");
      await store.writeActive(makeSnapshot("spring-sundays", "2026-05-03T14:05:00Z"));

      const result = await store.promoteActiveToSeason("spring-2026", "spring-sundays");
      expect(result).toEqual({
        seasonPath: "snapshots/seasons/spring-2026/spring-sundays.json",
        deletedActive: true,
        deletedArchiveCount: 2,
      });
      const frozen = await store.listSeasonSnapshots("spring-2026");
      expect(frozen.map((s) => s.ingestedAt)).toEqual(["2026-05-03T14:05:00Z"]);
      expect(await store.readActive("spring-sundays")).toBeNull();
      expect(await store.listArchive("spring-sundays")).toEqual([]);
    });

    it("is a no-op when there is no active snapshot to promote", async () => {
      const result = await store.promoteActiveToSeason("spring-2026", "missing");
      expect(result).toEqual({ seasonPath: null, deletedActive: false, deletedArchiveCount: 0 });
      expect(await store.listSeasonKeys()).toEqual([]);
    });
  });
});
