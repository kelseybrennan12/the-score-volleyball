import { runDatabaseBootstrap } from "backend/runtime/adapters/infra/db/init";
import { getBootstrapConfig } from "backend/runtime/adapters/infra/env";

const main = async (): Promise<void> => {
  const config = getBootstrapConfig();
  await runDatabaseBootstrap(config);
};

void main().catch(() => {
  process.exit(1);
});
