import type { AppDbLike } from "backend/runtime/adapters/infra/db/client";
import type { EnqueueJobInput } from "backend/runtime/ports/write";

export interface QueueTaskRecord {
  id: string;
  backendJobId: string;
  jobType: string;
  correlationId: string;
  appSchema: string | null;
  traceparent: string | null;
  tracestate: string | null;
  jobRunId: string | null;
  parentJobRunId: string | null;
  rootJobRunId: string | null;
  batchId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  runAt: Date | null;
  queueName: string | null;
  priority: number | null;
}

export type QueueTaskHandler = (task: QueueTaskRecord) => Promise<void>;
export type QueueTaskRegistry = Record<string, QueueTaskHandler>;
export interface CronScheduleItem {
  task: string;
  schedule: string;
  payload?: Record<string, unknown>;
  options?: {
    backfillPeriodMs?: number;
    maxAttempts?: number;
    queueName?: string;
    priority?: number;
  };
  identifier?: string;
}

export type QueueDepthState = "runnable" | "scheduled";

export interface QueueDepthRecord {
  jobType: string;
  queueState: QueueDepthState;
  depth: number;
}

export interface QueueLagRecord {
  jobType: string;
  lagSeconds: number;
}

export interface QueueStatsSnapshot {
  depthByType: QueueDepthRecord[];
  lagSecondsByType: QueueLagRecord[];
}

export interface QueueEnqueueResult {
  backendJobId: string;
  runAt: Date;
}
export interface QueueEnqueueOptions {
  appSchema?: string | null;
}
export interface JobQueueClient {
  prepare(): Promise<void>;
  enqueue(db: AppDbLike, input: EnqueueJobInput, options?: QueueEnqueueOptions): Promise<QueueEnqueueResult>;
  startWorker(taskRegistry: QueueTaskRegistry, cronSchedule?: CronScheduleItem[]): Promise<void>;
  stopWorker(): Promise<void>;
}
