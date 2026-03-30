import {
  closeDb,
  createDbRuntime,
  getDb,
  normalizeSchemaName,
  type CreateDbRuntimeInput,
  type DbRuntime,
} from "backend/runtime/adapters/infra/db/client";
import type { JobQueueClient } from "backend/runtime/adapters/infra/jobs/queue-port";
import { createDrizzleRepoBundle } from "backend/runtime/adapters/repos/drizzle-write";
import type { RepoBundle } from "backend/runtime/ports/write";
import { AsyncLocalStorage } from "node:async_hooks";

interface RepoBundleSchemaContext {
  schemaName: string | null;
  runtime: RepoBundleRuntime | null;
}

export interface RepoBundleRuntime extends DbRuntime {
  repos: RepoBundle;
}

export interface CreateRepoBundleRuntimeInput extends CreateDbRuntimeInput {
  jobQueueClient?: JobQueueClient;
}

const repoBundleSchemaContext = new AsyncLocalStorage<RepoBundleSchemaContext>();

let defaultRepos: RepoBundle | undefined;

export const createRepoBundleRuntime = (input: CreateRepoBundleRuntimeInput = {}): RepoBundleRuntime => {
  const runtime = createDbRuntime(input);
  const schemaName = normalizeSchemaName(input.schemaName);
  return {
    ...runtime,
    repos: createDrizzleRepoBundle(runtime.db, {
      jobQueueClient: input.jobQueueClient,
      schemaName: schemaName ?? null,
    }),
  };
};

const getDefaultRepoBundle = (): RepoBundle => {
  if (defaultRepos) {
    return defaultRepos;
  }

  defaultRepos = createDrizzleRepoBundle(getDb());
  return defaultRepos;
};

export const getActiveRepoBundleSchema = (): string | null => {
  return repoBundleSchemaContext.getStore()?.schemaName ?? null;
};

export const getRepoBundleForSchema = (schemaName: string | null | undefined): RepoBundle => {
  const normalizedSchemaName = normalizeSchemaName(schemaName ?? undefined) ?? null;
  if (!normalizedSchemaName) {
    return getDefaultRepoBundle();
  }

  const activeRuntime = repoBundleSchemaContext.getStore()?.runtime;
  if (activeRuntime && getActiveRepoBundleSchema() === normalizedSchemaName) {
    return activeRuntime.repos;
  }

  throw new Error(`Schema-scoped repo bundle "${normalizedSchemaName}" requires an attached runtime`);
};

export const runWithRepoBundleSchema = async <T>(
  schemaName: string | null | undefined,
  run: () => Promise<T>,
): Promise<T> => {
  const normalizedSchemaName = normalizeSchemaName(schemaName ?? undefined) ?? null;

  if (!normalizedSchemaName) {
    return repoBundleSchemaContext.run({ schemaName: null, runtime: null }, run);
  }

  const runtime = createRepoBundleRuntime({
    schemaName: normalizedSchemaName,
    maxConnections: 1,
  });

  try {
    return await repoBundleSchemaContext.run({ schemaName: normalizedSchemaName, runtime }, run);
  } finally {
    await runtime.close();
  }
};

export const getRepoBundle = (): RepoBundle => {
  return getRepoBundleForSchema(getActiveRepoBundleSchema());
};

export const closeRepoBundle = async (): Promise<void> => {
  defaultRepos = undefined;
  await closeDb();
};
