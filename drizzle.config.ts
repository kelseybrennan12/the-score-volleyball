import { defineConfig } from "drizzle-kit";
import { getMigrationDbConfig } from "./src/backend/runtime/adapters/infra/env";

const dbConfig = getMigrationDbConfig();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/backend/runtime/adapters/infra/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbConfig.databaseUrl,
  },
  verbose: true,
  strict: false,
});
