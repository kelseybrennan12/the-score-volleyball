import { createApiRouter } from "backend/runtime/bootstrap/api-router";
import type { RepoBundle } from "backend/runtime/ports/write";
import { describe, expect, test, vi } from "vitest";

const auth = {
  requireAuthorizedSession: vi.fn().mockResolvedValue({
    ok: false,
    statusCode: 401,
    error: "unauthenticated",
  }),
} as any;

const repos = {
  readRepo: {
    ping: vi.fn().mockResolvedValue(undefined),
  },
  withTransaction: vi.fn(),
} as unknown as RepoBundle;

const caller = createApiRouter(auth).createCaller({
  req: { headers: {} },
  repos,
  auth,
  correlationId: "auth-guard-test",
  authContext: null,
  blobStorageContainerName: "user-uploads",
});

describe("starter route auth guard", () => {
  test("health stays public", async () => {
    await expect(caller.health.status()).resolves.toEqual({ status: "ok", service: "api" });
  });

  test.each([
    ["db.status", () => caller.db.status()],
    ["db.metadata", () => caller.db.metadata({})],
    ["jobs.enqueueExample", () => caller.jobs.enqueueExample()],
    ["jobs.listRuns", () => caller.jobs.listRuns({})],
    ["session.me", () => caller.session.me()],
  ])("%s requires auth", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({
      code: expect.stringMatching(/^(UNAUTHORIZED|FORBIDDEN)$/),
    });
  });
});
