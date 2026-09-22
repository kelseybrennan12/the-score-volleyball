import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { handleCronIngest } from "@/backend/logic/services/cron-ingest";
import { createSnapshotStore, type SnapshotStore } from "@/backend/logic/services/snapshot-store";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { createMemoryObjectStore } from "@/backend/runtime/adapters/object-store/memory";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const fixturesDir = path.join(process.cwd(), "src/tests/fixtures");
const SECRET = "test-cron-secret";

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

describe("handleCronIngest", () => {
  let sundaysBuffer: Buffer;
  let store: SnapshotStore;

  beforeEach(async () => {
    sundaysBuffer = await readFile(path.join(fixturesDir, "spring-sundays-2026.xlsx"));
    store = createSnapshotStore(createMemoryObjectStore());
  });

  function fetcherForSundays(): SheetsFetcher {
    return {
      async fetchXlsx(sheetId: string): Promise<Buffer> {
        if (sheetId === "sheet-sundays") return sundaysBuffer;
        throw new Error(`unreachable ${sheetId}`);
      },
    };
  }

  it("rejects with 503 when CRON_SECRET is missing", async () => {
    const result = await handleCronIngest({
      authorization: `Bearer ${SECRET}`,
      cronSecret: undefined,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: "CRON_SECRET not configured" });
  });

  it("rejects with 401 when the bearer token is missing or wrong", async () => {
    const noHeader = await handleCronIngest({
      authorization: null,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(noHeader.status).toBe(401);

    const wrongScheme = await handleCronIngest({
      authorization: `Token ${SECRET}`,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(wrongScheme.status).toBe(401);

    const wrongValue = await handleCronIngest({
      authorization: `Bearer not-the-secret`,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(wrongValue.status).toBe(401);
  });

  it("returns 200 with skipped=true when inside the cooldown window", async () => {
    await store.setLastIngestedAt(new Date().toISOString());
    const result = await handleCronIngest({
      authorization: `Bearer ${SECRET}`,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, skipped: true, reason: "cooldown" });
  });

  it("runs ingestion and writes a snapshot when authorized and outside cooldown", async () => {
    const result = await handleCronIngest({
      authorization: `Bearer ${SECRET}`,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("expected success body");
    expect(result.body.ok).toBe(true);
    expect(result.body.skipped).toBeUndefined();
    expect(result.body.results).toHaveLength(1);
    expect(result.body.results![0].ok).toBe(true);
    expect(await store.readActive("spring-sundays")).not.toBeNull();
  });

  it("returns 200 with per-league failures rather than failing the cron", async () => {
    const result = await handleCronIngest({
      authorization: `Bearer ${SECRET}`,
      cronSecret: SECRET,
      sources: [failingSource, sundaysSource],
      fetcher: fetcherForSundays(),
      store,
    });
    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("expected success body");
    expect(result.body.results).toHaveLength(2);
    expect(result.body.results![0].ok).toBe(false);
    expect(result.body.results![1].ok).toBe(true);
  });

  it("returns 500 when the pipeline throws (e.g. snapshot store unavailable)", async () => {
    const brokenStore: SnapshotStore = {
      ...store,
      async getLastIngestedAt() {
        throw new Error("blob outage");
      },
    };
    const result = await handleCronIngest({
      authorization: `Bearer ${SECRET}`,
      cronSecret: SECRET,
      sources: [sundaysSource],
      fetcher: fetcherForSundays(),
      store: brokenStore,
    });
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "blob outage" });
  });
});
