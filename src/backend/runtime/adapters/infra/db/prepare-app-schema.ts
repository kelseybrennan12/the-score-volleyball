import type { DbConfig } from "backend/runtime/adapters/infra/env";
import { Pool } from "pg";

const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

export const ensureAppSchemaExists = async (config: DbConfig): Promise<void> => {
  if (!config.appSchema) {
    return;
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
  });

  try {
    await pool.query(`create schema if not exists ${quoteIdentifier(config.appSchema)}`);
  } finally {
    await pool.end();
  }
};
