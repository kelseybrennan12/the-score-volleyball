import { getDatabaseMetadata } from "backend/logic/services/db-metadata";
import { getDatabaseStatus } from "backend/logic/services/db-status";
import { listExampleJobRuns, triggerExampleDbPing } from "backend/logic/services/example-jobs";
import { getSessionMe } from "backend/logic/services/session-me";
import type { RepoBundle } from "backend/runtime/ports/write";
import { describe, expect, test, vi } from "vitest";

const now = new Date("2026-03-26T12:00:00.000Z");

const makeRepos = () => {
  const repos = {
    readRepo: {
      ping: vi.fn().mockResolvedValue(undefined),
      getDatabaseStatus: vi.fn().mockResolvedValue({
        databaseName: "starter_db",
        currentSchema: "public",
        serverTime: now,
        version: "PostgreSQL 16",
        graphileSchema: "graphile_worker",
      }),
      getDatabaseMetadata: vi.fn().mockResolvedValue({
        schemas: ["public", "graphile_worker"],
        tables: [
          { schemaName: "public", tableName: "example", tableType: "BASE TABLE" },
          { schemaName: "graphile_worker", tableName: "jobs", tableType: "VIEW" },
        ],
      }),
      listGraphileWorkerJobs: vi.fn().mockResolvedValue([
        {
          backendJobId: "job-1",
          jobType: "example.db_ping",
          queueName: "default",
          runAt: now,
          createdAt: now,
          attempts: 0,
          maxAttempts: 1,
          lastError: null,
          status: "pending",
        },
      ]),
    },
    withTransaction: vi.fn().mockImplementation(async (fn) =>
      fn({
        writeRepo: {
          enqueueJobRequest: vi.fn().mockResolvedValue({
            id: "request-1",
            jobRunId: "job-run-1",
            parentJobRunId: null,
            rootJobRunId: null,
            batchId: null,
            jobType: "example.db_ping",
            correlationId: "corr-1",
            status: "pending",
            attempts: 0,
            lastError: null,
          }),
        },
      }),
    ),
  } as unknown as RepoBundle;

  return repos;
};

describe("starter backend surface", () => {
  test("returns read-only database status and metadata", async () => {
    const repos = makeRepos();

    await expect(getDatabaseStatus(repos)).resolves.toMatchObject({
      databaseName: "starter_db",
      currentSchema: "public",
      graphileSchema: "graphile_worker",
    });
    await expect(getDatabaseMetadata(repos, { limit: 10 })).resolves.toMatchObject({
      schemas: ["public", "graphile_worker"],
      tables: [
        { schemaName: "public", tableName: "example", tableType: "BASE TABLE" },
        { schemaName: "graphile_worker", tableName: "jobs", tableType: "VIEW" },
      ],
    });
  });

  test("queues and lists the example Graphile job", async () => {
    const repos = makeRepos();

    await expect(triggerExampleDbPing(repos, "corr-1")).resolves.toMatchObject({
      jobType: "example.db_ping",
      correlationId: "corr-1",
    });
    await expect(listExampleJobRuns(repos, { limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        jobType: "example.db_ping",
        status: "pending",
      }),
    ]);
  });

  test("session.me keeps the current authenticated user visible", () => {
    expect(
      getSessionMe({
        sessionId: "session-1",
        claims: {
          iss: "https://example.com",
          aud: "starter-api",
          sub: "subject-1",
          tid: "tenant-1",
          oid: "aad-1",
          exp: Math.floor(now.getTime() / 1000) + 3600,
        },
        user: {
          id: "user-1",
          tenantId: "tenant-1",
          aadObjectId: "aad-1",
          email: "starter@example.com",
          displayName: "Starter User",
          role: "admin",
          isAuthorized: true,
          isActive: true,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ).toEqual({
      authenticated: true,
      sessionId: "session-1",
      user: {
        id: "user-1",
        tenantId: "tenant-1",
        email: "starter@example.com",
        displayName: "Starter User",
        role: "admin",
        isAuthorized: true,
        isActive: true,
      },
    });
  });
});
