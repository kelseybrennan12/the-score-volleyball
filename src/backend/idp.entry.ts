import { createIdpRuntime } from "backend/runtime/bootstrap/idp-http-runtime";

const main = async (): Promise<void> => {
  const runtime = createIdpRuntime();

  const shutdown = async (): Promise<void> => {
    await runtime.shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  try {
    await runtime.start();
  } catch {
    process.exit(1);
  }
};

void main().catch(() => {
  process.exit(1);
});
