import { getJobQueueConfig } from "backend/runtime/adapters/infra/env";
import { createGraphileJobQueueClient } from "backend/runtime/adapters/infra/jobs/graphile-client";
import type { JobQueueClient } from "backend/runtime/adapters/infra/jobs/queue-port";

let queueClient: JobQueueClient | undefined;

export const getJobQueueClient = (): JobQueueClient => {
  if (queueClient) {
    return queueClient;
  }

  const config = getJobQueueConfig();
  queueClient = createGraphileJobQueueClient({
    databaseUrl: config.databaseUrl,
    schema: config.graphileSchema,
    pollIntervalMs: config.pollIntervalMs,
    concurrency: config.concurrency,
    schemaOverrideEnabled: config.schemaOverrideEnabled,
  });

  return queueClient;
};
