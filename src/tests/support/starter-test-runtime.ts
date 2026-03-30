import { createGraphileJobQueueClient } from "backend/runtime/adapters/infra/jobs/graphile-client";
import { createRepoBundleRuntime, type RepoBundleRuntime } from "backend/runtime/adapters/infra/repo-bundle";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const appTableNames = ["system_users", "system_auth_sessions", "system_auth_login_states"] as const;

const sanitizeIdentifier = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const withPrefix = normalized.length > 0 && /^[a-z_]/.test(normalized) ? normalized : `starter_${normalized}`;
  return withPrefix;
};

const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

export const resolveTestDatabaseUrl = (): string => {
  const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing INTEGRATION_TEST_DATABASE_URL or DATABASE_URL for starter tests");
  }

  return databaseUrl;
};

export const resolveTestGraphileSchema = (): string => {
  return (
    process.env.TEST_JOBS_GRAPHILE_SCHEMA?.trim() || process.env.JOBS_GRAPHILE_SCHEMA?.trim() || "graphile_worker_test"
  );
};

const createPool = (): Pool => {
  return new Pool({
    connectionString: resolveTestDatabaseUrl(),
  });
};

const createSchemaName = (prefix: string): string => {
  const safePrefix = sanitizeIdentifier(prefix);
  const suffix = randomUUID().replaceAll("-", "_");
  return sanitizeIdentifier(`${safePrefix}_${suffix}`).slice(0, 63);
};

const seedStarterUsers = async (pool: Pool, schemaName: string): Promise<void> => {
  const schemaIdentifier = quoteIdentifier(schemaName);

  await pool.query(
    `
      insert into ${schemaIdentifier}.system_users (
        id,
        tenant_id,
        aad_object_id,
        email,
        display_name,
        role,
        is_authorized,
        is_active,
        last_seen_at
      )
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, now()),
        ($9, $10, $11, $12, $13, $14, $15, $16, now())
      on conflict (id) do nothing
    `,
    [
      "dev-tenant:user-admin",
      "dev-tenant",
      "user-admin",
      "admin@starter.local",
      "Starter Admin",
      "admin",
      true,
      true,
      "dev-tenant:user-operator",
      "dev-tenant",
      "user-operator",
      "operator@starter.local",
      "Starter Operator",
      "user",
      true,
      true,
    ],
  );
};

const createAppTables = async (pool: Pool, schemaName: string): Promise<void> => {
  const schemaIdentifier = quoteIdentifier(schemaName);

  await pool.query(`create schema if not exists ${schemaIdentifier}`);

  for (const tableName of appTableNames) {
    const tableIdentifier = quoteIdentifier(tableName);
    await pool.query(
      `create table if not exists ${schemaIdentifier}.${tableIdentifier} (like public.${tableIdentifier} including all)`,
    );
  }
};

const deleteScenarioGraphileJobs = async (pool: Pool, schemaName: string): Promise<void> => {
  const graphileSchemaIdentifier = quoteIdentifier(resolveTestGraphileSchema());

  try {
    await pool.query(
      `delete from ${graphileSchemaIdentifier}._private_jobs where payload -> 'meta' ->> 'appSchema' = $1`,
      [schemaName],
    );
  } catch {
    // Local cleanup should not fail if the graphile schema has already been reset.
  }
};

export interface IsolatedStarterSchema {
  schemaName: string;
  clearExampleJobs(): Promise<void>;
  countExampleJobs(): Promise<number>;
  destroy(): Promise<void>;
}

export const createIsolatedStarterSchema = async (prefix: string = "starter"): Promise<IsolatedStarterSchema> => {
  const schemaName = createSchemaName(prefix);
  const pool = createPool();

  try {
    await createAppTables(pool, schemaName);
    await seedStarterUsers(pool, schemaName);
  } finally {
    await pool.end();
  }

  return {
    schemaName,
    clearExampleJobs: async (): Promise<void> => {
      const cleanupPool = createPool();

      try {
        await deleteScenarioGraphileJobs(cleanupPool, schemaName);
      } finally {
        await cleanupPool.end();
      }
    },
    countExampleJobs: async (): Promise<number> => {
      const pool = createPool();

      try {
        const result = await pool.query<{ count: string }>(
          `select count(*)::text as count from ${quoteIdentifier(resolveTestGraphileSchema())}._private_jobs where payload -> 'meta' ->> 'appSchema' = $1`,
          [schemaName],
        );
        return Number(result.rows[0]?.count ?? 0);
      } finally {
        await pool.end();
      }
    },
    destroy: async (): Promise<void> => {
      const cleanupPool = createPool();

      try {
        await deleteScenarioGraphileJobs(cleanupPool, schemaName);
        await cleanupPool.query(`drop schema if exists ${quoteIdentifier(schemaName)} cascade`);
      } finally {
        await cleanupPool.end();
      }
    },
  };
};

export interface IsolatedRepoBundleRuntime {
  schemaName: string;
  runtime: RepoBundleRuntime;
  destroy(): Promise<void>;
}

export const createIsolatedRepoBundleRuntime = async (
  prefix: string = "starter",
): Promise<IsolatedRepoBundleRuntime> => {
  const scenario = await createIsolatedStarterSchema(prefix);
  const runtime = createRepoBundleRuntime({
    databaseUrl: resolveTestDatabaseUrl(),
    schemaName: scenario.schemaName,
    jobQueueClient: createGraphileJobQueueClient({
      databaseUrl: resolveTestDatabaseUrl(),
      schema: resolveTestGraphileSchema(),
      pollIntervalMs: 1000,
      concurrency: 1,
      schemaOverrideEnabled: true,
    }),
  });

  return {
    schemaName: scenario.schemaName,
    runtime,
    destroy: async (): Promise<void> => {
      await runtime.close();
      await scenario.destroy();
    },
  };
};

export interface PersistedGraphileJobRecord {
  backendJobId: string;
  taskIdentifier: string;
  appSchema: string | null;
}

export const findGraphileJobByExternalId = async (externalId: string): Promise<PersistedGraphileJobRecord | null> => {
  const pool = createPool();

  try {
    const result = await pool.query<{
      backend_job_id: string;
      task_identifier: string;
      app_schema: string | null;
    }>(
      `
        select
          jobs.id::text as backend_job_id,
          tasks.identifier as task_identifier,
          jobs.payload -> 'meta' ->> 'appSchema' as app_schema
        from ${quoteIdentifier(resolveTestGraphileSchema())}._private_jobs as jobs
        inner join ${quoteIdentifier(resolveTestGraphileSchema())}._private_tasks as tasks
          on tasks.id = jobs.task_id
        where jobs.payload -> 'meta' ->> 'externalId' = $1
        limit 1
      `,
      [externalId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      backendJobId: row.backend_job_id,
      taskIdentifier: row.task_identifier,
      appSchema: row.app_schema,
    };
  } finally {
    await pool.end();
  }
};

export const waitForGraphileJobByExternalId = async (
  externalId: string,
  timeoutMs: number = 5_000,
): Promise<PersistedGraphileJobRecord> => {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const job = await findGraphileJobByExternalId(externalId);
    if (job) {
      return job;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for graphile job with external id ${externalId}`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
};
