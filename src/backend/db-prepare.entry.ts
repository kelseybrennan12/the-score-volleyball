import { ensureAppSchemaExists } from "./runtime/adapters/infra/db/prepare-app-schema";
import { getDbConfig } from "./runtime/adapters/infra/env";

const main = async (): Promise<void> => {
  await ensureAppSchemaExists(getDbConfig());
};

void main().catch(() => {
  process.exit(1);
});
