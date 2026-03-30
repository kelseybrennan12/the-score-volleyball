import { ValueType } from "@opentelemetry/api";
import { getMeter } from "backend/runtime/adapters/infra/telemetry";

export type JobExecutionOutcome = "completed" | "failed";

export interface JobsMetrics {
  markClaimed(jobType: string): void;
  markProcessed(jobType: string): void;
  markFailed(jobType: string): void;
  recordQueueWait(jobType: string, queueWaitMs: number): void;
  recordDuration(jobType: string, outcome: JobExecutionOutcome, durationMs: number): void;
}

export const createJobsMetrics = (): JobsMetrics => {
  const meter = getMeter("starter-jobs");
  const jobsClaimed = meter.createCounter("starter_jobs_claimed", {
    description: "Total job attempts claimed by workers",
    valueType: ValueType.INT,
  });
  const jobsProcessed = meter.createCounter("starter_jobs_processed", {
    description: "Total job requests processed",
    valueType: ValueType.INT,
  });
  const jobsFailed = meter.createCounter("starter_jobs_failed", {
    description: "Total job requests failed",
    valueType: ValueType.INT,
  });
  const jobsQueueWait = meter.createHistogram("starter_jobs_queue_wait_ms", {
    description: "Time in milliseconds between scheduled run_at and claim",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });
  const jobsDuration = meter.createHistogram("starter_jobs_duration_ms", {
    description: "Background job execution duration in milliseconds",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });

  return {
    markClaimed: (jobType: string) => {
      jobsClaimed.add(1, { job_type: jobType });
    },
    markProcessed: (jobType: string) => {
      jobsProcessed.add(1, { job_type: jobType });
    },
    markFailed: (jobType: string) => {
      jobsFailed.add(1, { job_type: jobType });
    },
    recordQueueWait: (jobType: string, queueWaitMs: number) => {
      jobsQueueWait.record(queueWaitMs, { job_type: jobType });
    },
    recordDuration: (jobType: string, outcome: JobExecutionOutcome, durationMs: number) => {
      jobsDuration.record(durationMs, {
        job_type: jobType,
        outcome,
      });
    },
  };
};
