import { getDatabaseMetadata } from "backend/logic/services/db-metadata";
import { getDatabaseStatus } from "backend/logic/services/db-status";
import { listExampleJobRuns, triggerExampleDbPing } from "backend/logic/services/example-jobs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createIsolatedRepoBundleRuntime,
  resolveTestGraphileSchema,
  waitForGraphileJobByExternalId,
  type IsolatedRepoBundleRuntime,
} from "../../../support/starter-test-runtime";

describe("starter service integration", () => {
  let fixture: IsolatedRepoBundleRuntime;

  beforeEach(async () => {
    fixture = await createIsolatedRepoBundleRuntime("services");
  });

  afterEach(async () => {
    await fixture.destroy();
  });

  test("getDatabaseStatus reports the live database and isolated schema", async () => {
    const status = await getDatabaseStatus(fixture.runtime.repos);

    expect(status.databaseName).toBeTruthy();
    expect(status.currentSchema).toBe(fixture.schemaName);
    expect(status.graphileSchema).toBe(resolveTestGraphileSchema());
    expect(status.serverTime).toBeInstanceOf(Date);
    expect(status.version).toContain("PostgreSQL");
  });

  test("getDatabaseMetadata lists starter tables in the isolated schema", async () => {
    const metadata = await getDatabaseMetadata(fixture.runtime.repos, { limit: 50 });

    expect(metadata.schemas).toContain(fixture.schemaName);
    expect(metadata.tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaName: fixture.schemaName,
          tableName: "system_users",
          tableType: "BASE TABLE",
        }),
        expect.objectContaining({
          schemaName: fixture.schemaName,
          tableName: "system_auth_sessions",
          tableType: "BASE TABLE",
        }),
      ]),
    );
  });

  test("triggerExampleDbPing persists a graphile job and listExampleJobRuns exposes it", async () => {
    const enqueued = await triggerExampleDbPing(fixture.runtime.repos, `services-${fixture.schemaName}`);
    const persisted = await waitForGraphileJobByExternalId(enqueued.id);
    const runs = await listExampleJobRuns(fixture.runtime.repos, { limit: 25 });

    expect(enqueued.jobType).toBe("example.db_ping");
    expect(enqueued.status).toBe("pending");
    expect(persisted.taskIdentifier).toBe("example.db_ping");
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
