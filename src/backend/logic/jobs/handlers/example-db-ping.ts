import { getRepoBundle } from "backend/runtime/adapters/infra/repo-bundle";
import type { JobRequestRecord } from "backend/runtime/ports/read";

interface JobLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export const handleExampleDbPingJob = async (job: JobRequestRecord, deps: { logger: JobLogger }): Promise<void> => {
  const repos = getRepoBundle();
  const status = await repos.readRepo.getDatabaseStatus();

  deps.logger.info(
    {
      event: "job.example_db_ping.completed",
      correlation_id: job.correlationId,
      job_id: job.id,
      job_type: job.jobType,
      database_name: status.databaseName,
      current_schema: status.currentSchema,
      graphile_schema: status.graphileSchema,
    },
    "completed example database ping job",
  );
};
