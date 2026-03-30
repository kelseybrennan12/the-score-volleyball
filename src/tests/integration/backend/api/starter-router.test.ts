import type { AuthenticatedRequestContext } from "backend/runtime/adapters/infra/auth";
import { createApiRouter } from "backend/runtime/bootstrap/api-router";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createIsolatedRepoBundleRuntime,
  waitForGraphileJobByExternalId,
  type IsolatedRepoBundleRuntime,
} from "../../../support/starter-test-runtime";

describe("starter api router integration", () => {
  let fixture: IsolatedRepoBundleRuntime;

  beforeEach(async () => {
    fixture = await createIsolatedRepoBundleRuntime("router");
  });

  afterEach(async () => {
    await fixture.destroy();
  });

  const createAuthorizedCaller = async () => {
    const users = await fixture.runtime.repos.readRepo.listUsers();
    const adminUser = users.find((user) => user.aadObjectId === "user-admin");

    if (!adminUser) {
      throw new Error("Missing seeded starter admin user");
    }

    const authContext: AuthenticatedRequestContext = {
      sessionId: `itest-session-${randomUUID()}`,
      claims: {
        iss: "https://starter.test/idp",
        aud: "project-starter",
        sub: adminUser.aadObjectId,
        tid: adminUser.tenantId,
        oid: adminUser.aadObjectId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        preferred_username: adminUser.email ?? undefined,
        name: adminUser.displayName ?? undefined,
      },
      user: adminUser,
    };

    const auth = {
      requireAuthorizedSession: async () => ({
        ok: true as const,
        context: authContext,
      }),
    };

    return createApiRouter(auth as any).createCaller({
      req: { headers: {} },
      repos: fixture.runtime.repos,
      auth: auth as any,
      correlationId: `itest-correlation-${randomUUID()}`,
      authContext: null,
      blobStorageContainerName: "user-uploads",
    });
  };

  test("health stays public while protected routes return live starter data", async () => {
    const caller = await createAuthorizedCaller();
    const [health, dbStatus, dbMetadata, session] = await Promise.all([
      caller.health.status(),
      caller.db.status(),
      caller.db.metadata({ limit: 25 }),
      caller.session.me(),
    ]);

    expect(health).toEqual({ status: "ok", service: "api" });
    expect(dbStatus.currentSchema).toBe(fixture.schemaName);
    expect(dbMetadata.tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaName: fixture.schemaName,
          tableName: "system_users",
        }),
      ]),
    );
    expect(session).toEqual(
      expect.objectContaining({
        authenticated: true,
        user: expect.objectContaining({
          displayName: "Starter Admin",
          role: "admin",
        }),
      }),
    );
  });

  test("jobs routes enqueue and list graphile-backed example work", async () => {
    const caller = await createAuthorizedCaller();
    const enqueued = await caller.jobs.enqueueExample();
    const persisted = await waitForGraphileJobByExternalId(enqueued.id);
    const runs = await caller.jobs.listRuns({ limit: 25 });

    expect(enqueued).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        jobType: "example.db_ping",
        status: "pending",
      }),
    );
    expect(persisted.appSchema).toBe(fixture.schemaName);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backendJobId: persisted.backendJobId,
          jobType: "example.db_ping",
        }),
      ]),
    );
  });
});
