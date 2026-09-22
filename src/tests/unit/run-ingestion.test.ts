import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { runIngestion } from "@/backend/logic/services/run-ingestion";
import { createSnapshotStore } from "@/backend/logic/services/snapshot-store";
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

describe("runIngestion", () => {
  let sundaysBuffer: Buffer;

  beforeEach(async () => {
    sundaysBuffer = await readFile(path.join(fixturesDir, "spring-sundays-2026.xlsx"));
  });

  function makeFetcher(): SheetsFetcher {
    return {
      async fetchXlsx(sheetId: string): Promise<Buffer> {
        if (sheetId === "sheet-sundays") return sundaysBuffer;
        throw new Error(`unreachable ${sheetId}`);
      },
    };
  }

  it("writes active + meta on successful ingest", async () => {
    const store = createSnapshotStore(createMemoryObjectStore());
    const { results, ranAt } = await runIngestion({
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
    });
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].teamCount).toBeGreaterThan(0);
    expect(await store.getLastIngestedAt()).toBe(ranAt);
    expect(await store.readActive("spring-sundays")).not.toBeNull();
  });

  it("records per-league failures without aborting the run", async () => {
    const store = createSnapshotStore(createMemoryObjectStore());
    const { results } = await runIngestion({
      sources: [failingSource, sundaysSource],
      fetcher: makeFetcher(),
      store,
    });
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toContain("unreachable");
    expect(results[1].ok).toBe(true);
    expect(await store.getLastIngestedAt()).not.toBeNull();
  });

  it("dry-run skips writes and does not update meta", async () => {
    const store = createSnapshotStore(createMemoryObjectStore());
    await runIngestion({
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      store,
      dryRun: true,
    });
    expect(await store.readActive("spring-sundays")).toBeNull();
    expect(await store.getLastIngestedAt()).toBeNull();
  });
});
