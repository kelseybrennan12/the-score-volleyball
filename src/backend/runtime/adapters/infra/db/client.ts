import * as schema from "backend/runtime/adapters/infra/db/schema";
import { getDbConfig } from "backend/runtime/adapters/infra/env";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type AppDb = NodePgDatabase<typeof schema>;
export type AppTxDb = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
export type AppDbLike = AppDb | AppTxDb;

export interface CreateDbRuntimeInput {
  databaseUrl?: string;
  schemaName?: string;
  maxConnections?: number;
}

export interface DbRuntime {
  db: AppDb;
  pool: Pool;
  close(): Promise<void>;
}

let pool: Pool | undefined;
let db: AppDb | undefined;

export const schemaNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const normalizeSchemaName = (schemaName: string | undefined): string | undefined => {
  const normalized = schemaName?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!schemaNamePattern.test(normalized)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
  return normalized;
};

export const createDbRuntime = (input: CreateDbRuntimeInput = {}): DbRuntime => {
  const dbConfig = input.databaseUrl ? null : getDbConfig();
  const databaseUrl = input.databaseUrl ?? dbConfig!.databaseUrl;
  const schemaName = normalizeSchemaName(input.schemaName ?? dbConfig?.appSchema ?? undefined);
  const createdPool = new Pool({
    connectionString: databaseUrl,
    ...(schemaName ? { options: `-csearch_path=${schemaName},public` } : {}),
    ...(typeof input.maxConnections === "number" ? { max: input.maxConnections } : {}),
  });
  const createdDb = drizzle(createdPool, { schema });

  return {
    db: createdDb,
    pool: createdPool,
    close: async () => {
      await createdPool.end();
    },
  };
};

export const getDb = (): AppDb => {
  if (db) {
    return db;
  }

  const runtime = createDbRuntime();
  pool = runtime.pool;
  db = runtime.db;

  return db;
};

export const closeDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
  }

  pool = undefined;
  db = undefined;
};
