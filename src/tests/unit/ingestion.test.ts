import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { runIngestion } from "@/backend/logic/services/ingestion";
import { createSnapshotStore, type SnapshotStore } from "@/backend/logic/services/snapshot-store";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { createMemoryObjectStore } from "@/backend/runtime/adapters/object-store/memory";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const fixturesDir = path.join(process.cwd(), "src/tests/fixtures");

const sundaysSource: LeagueSource = {
  slug: "spring-sundays",
  displayName: "Spring Sundays",
  session: "spring",
  year: 2026,
  day: "sunday",
  sheetId: "sheet-sundays",
};

const failingSource: LeagueSource = {
  slug: "spring-mondays",
  displayName: "Spring Mondays",
  session: "spring",
  year: 2026,
  day: "monday",
  sheetId: "sheet-mondays",
};

const NOW = new Date("2026-05-03T17:00:00Z");

describe("runIngestion", () => {
  let sundaysBuffer: Buffer;
  let store: SnapshotStore;
  let fetched: string[];

  beforeEach(async () => {
    sundaysBuffer = await readFile(path.join(fixturesDir, "spring-sundays-2026.xlsx"));
    store = createSnapshotStore(createMemoryObjectStore());
    fetched = [];
  });

  function makeFetcher(): SheetsFetcher {
    return {
      async fetchXlsx(sheetId: string): Promise<Buffer> {
        fetched.push(sheetId);
        if (sheetId === "sheet-sundays") return sundaysBuffer;
        throw new Error(`unreachable ${sheetId}`);
      },
    };
  }

  it("runs, writes the live snapshot, and stamps the last-ingested time", async () => {
    const outcome = await runIngestion({
      trigger: "cli",
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      now: () => NOW,
    });
    expect(outcome).toMatchObject({ status: "ran", ranAt: NOW.toISOString(), dryRun: false });
    if (outcome.status !== "ran") throw new Error("expected a run");
    expect(outcome.leagues).toHaveLength(1);
    expect(outcome.leagues[0]).toMatchObject({ slug: "spring-sundays", ok: true, rosterDiff: "same" });
    expect(await store.getLastIngestedAt()).toBe(NOW.toISOString());
    expect(await store.readActive("spring-sundays")).not.toBeNull();
  });

  it("records a failed league without aborting the run, and still stamps it", async () => {
    const outcome = await runIngestion({
      trigger: "cli",
      sources: [failingSource, sundaysSource],
      fetcher: makeFetcher(),
      store,
      now: () => NOW,
    });
    if (outcome.status !== "ran") throw new Error("expected a run");
    expect(outcome.leagues[0]).toEqual({ slug: "spring-mondays", ok: false, error: "unreachable sheet-mondays" });
    expect(outcome.leagues[1].ok).toBe(true);
    expect(await store.getLastIngestedAt()).toBe(NOW.toISOString());
  });

  it("reports leagues without the Snapshot store's keys", async () => {
    await runIngestion({ trigger: "cli", sources: [sundaysSource], fetcher: makeFetcher(), store, now: () => NOW });
    const outcome = await runIngestion({
      trigger: "cli",
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      now: () => NOW,
    });
    if (outcome.status !== "ran") throw new Error("expected a run");
    expect(Object.keys(outcome.leagues[0]).sort()).toEqual([
      "anomalies",
      "matchCount",
      "ok",
      "rosterDiff",
      "slug",
      "teamCount",
    ]);
  });

  it("dry run parses but neither writes a snapshot nor stamps the run", async () => {
    const outcome = await runIngestion({
      trigger: "cli",
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      dryRun: true,
      now: () => NOW,
    });
    expect(outcome).toMatchObject({ status: "ran", dryRun: true, leagues: [{ ok: true }] });
    expect(await store.readActive("spring-sundays")).toBeNull();
    expect(await store.getLastIngestedAt()).toBeNull();
  });

  it.each(["cron", "admin"] as const)(
    "skips a %s-started run inside the cooldown, reporting the remaining wait and fetching nothing",
    async (trigger) => {
      const last = new Date(NOW.getTime() - 2 * 60 * 1000).toISOString();
      await store.setLastIngestedAt(last);
      const outcome = await runIngestion({
        trigger,
        sources: [sundaysSource],
        fetcher: makeFetcher(),
        store,
        now: () => NOW,
      });
      expect(outcome).toEqual({
        status: "skipped",
        reason: "cooldown",
        lastIngestedAt: last,
        retryAfterMs: 3 * 60 * 1000,
      });
      expect(fetched).toEqual([]);
      expect(await store.getLastIngestedAt()).toBe(last);
    },
  );

  it("lets a CLI-started run through inside the cooldown", async () => {
    await store.setLastIngestedAt(new Date(NOW.getTime() - 60 * 1000).toISOString());
    const outcome = await runIngestion({
      trigger: "cli",
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      now: () => NOW,
    });
    expect(outcome.status).toBe("ran");
    expect(fetched).toEqual(["sheet-sundays"]);
  });

  it("runs a cron-started run once the full cooldown has passed", async () => {
    await store.setLastIngestedAt(new Date(NOW.getTime() - 5 * 60 * 1000).toISOString());
    const outcome = await runIngestion({
      trigger: "cron",
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      now: () => NOW,
    });
    expect(outcome.status).toBe("ran");
  });

  it("throws when the Snapshot store itself fails, so a route can answer 500", async () => {
    const broken: SnapshotStore = {
      ...store,
      async getLastIngestedAt() {
        throw new Error("blob outage");
      },
    };
    await expect(
      runIngestion({
        trigger: "cron",
        sources: [sundaysSource],
        fetcher: makeFetcher(),
        store: broken,
        now: () => NOW,
      }),
    ).rejects.toThrow("blob outage");
  });
});
