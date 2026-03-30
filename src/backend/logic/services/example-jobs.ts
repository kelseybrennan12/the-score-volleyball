import type { GraphileWorkerJobRecord, JobRequestRecord } from "backend/runtime/ports/read";
import type { EnqueueJobInput, RepoBundle } from "backend/runtime/ports/write";
import { randomUUID } from "node:crypto";

const enqueueJobRequest = async (repos: RepoBundle, input: EnqueueJobInput): Promise<JobRequestRecord> => {
  return repos.withTransaction(async ({ writeRepo }) => {
    return writeRepo.enqueueJobRequest(input);
  });
};

export const triggerExampleDbPing = async (repos: RepoBundle, correlationId: string): Promise<JobRequestRecord> => {
  return enqueueJobRequest(repos, {
    id: randomUUID(),
    jobType: "example.db_ping",
    correlationId,
    payload: {
      requestedAt: new Date().toISOString(),
    },
  });
};

export const listExampleJobRuns = async (
  repos: RepoBundle,
  input: { limit?: number } = {},
): Promise<GraphileWorkerJobRecord[]> => {
  return repos.readRepo.listGraphileWorkerJobs({
    limit: input.limit,
    taskIdentifierPrefix: "example.",
  });
};
