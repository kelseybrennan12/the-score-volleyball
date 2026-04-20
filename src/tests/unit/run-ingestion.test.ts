import type { LeagueSource } from "@/backend/logic/core/league-sources";
import { runIngestion } from "@/backend/logic/services/run-ingestion";
import type { SheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { createSnapshotRepo } from "@/backend/runtime/adapters/snapshots/fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  let root: string;
  let sundaysBuffer: Buffer;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ingest-"));
    sundaysBuffer = await readFile(path.join(fixturesDir, "spring-sundays-2026.xlsx"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
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
    const repo = createSnapshotRepo(root);
    const { results, ranAt } = await runIngestion({
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      repo,
    });
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].teamCount).toBeGreaterThan(0);
    expect(await repo.getLastIngestedAt()).toBe(ranAt);
    expect(await repo.readActive("spring-sundays")).not.toBeNull();
  });

  it("records per-league failures without aborting the run", async () => {
    const repo = createSnapshotRepo(root);
    const { results } = await runIngestion({
      sources: [failingSource, sundaysSource],
      fetcher: makeFetcher(),
      repo,
    });
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toContain("unreachable");
    expect(results[1].ok).toBe(true);
    expect(await repo.getLastIngestedAt()).not.toBeNull();
  });

  it("dry-run skips writes and does not update meta", async () => {
    const repo = createSnapshotRepo(root);
    await runIngestion({
      sources: [sundaysSource],
      fetcher: makeFetcher(),
      repo,
      dryRun: true,
    });
    expect(await repo.readActive("spring-sundays")).toBeNull();
    expect(await repo.getLastIngestedAt()).toBeNull();
  });
});
