import { context, propagation } from "@opentelemetry/api";
import { type AppDbLike } from "backend/runtime/adapters/infra/db/client";
import type {
  CronScheduleItem,
  JobQueueClient,
  QueueEnqueueOptions,
  QueueEnqueueResult,
  QueueTaskRecord,
  QueueTaskRegistry,
} from "backend/runtime/adapters/infra/jobs/queue-port";
import { emitTelemetryLog } from "backend/runtime/adapters/infra/telemetry";
import type { EnqueueJobInput } from "backend/runtime/ports/write";
import { sql } from "drizzle-orm";
import {
  Logger,
  parseCronItems,
  run,
  type CronItem,
  type LogFunctionFactory,
  type LogLevel,
  type Runner,
  type TaskList,
  type WorkerEvents,
} from "graphile-worker";
import { EventEmitter } from "node:events";
import { Pool } from "pg";

interface GraphileJobQueueConfig {
  databaseUrl: string;
  schema: string;
  pollIntervalMs: number;
  concurrency: number;
  schemaOverrideEnabled: boolean;
}

interface GraphilePayloadEnvelope {
  meta: {
    correlationId: string;
    externalId: string;
    appSchema?: string | null;
    traceparent?: string | null;
    tracestate?: string | null;
    jobRunId?: string | null;
    parentJobRunId?: string | null;
    rootJobRunId?: string | null;
    batchId?: string | null;
  };
  payload: Record<string, unknown>;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseDateLike = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toPayloadEnvelope = (input: EnqueueJobInput, options: QueueEnqueueOptions = {}): GraphilePayloadEnvelope => {
  const traceCarrier: Record<string, string> = {};
  propagation.inject(context.active(), traceCarrier);

  return {
    meta: {
      correlationId: input.correlationId,
      externalId: input.id,
      appSchema: options.appSchema ?? null,
      traceparent: traceCarrier.traceparent ?? null,
      tracestate: traceCarrier.tracestate ?? null,
      jobRunId: input.runContext?.jobRunId ?? null,
      parentJobRunId: input.runContext?.parentJobRunId ?? null,
      rootJobRunId: input.runContext?.rootJobRunId ?? null,
      batchId: input.runContext?.batchId ?? null,
    },
    payload: input.payload,
  };
};

const parsePayloadEnvelope = (payload: unknown): GraphilePayloadEnvelope => {
  if (!isObjectRecord(payload)) {
    return {
      meta: {
        correlationId: "unknown",
        externalId: "unknown",
        appSchema: null,
        traceparent: null,
        tracestate: null,
        jobRunId: null,
        parentJobRunId: null,
        rootJobRunId: null,
        batchId: null,
      },
      payload: {},
    };
  }

  const metaValue = payload.meta;
  const payloadValue = payload.payload;

  if (
    isObjectRecord(metaValue) &&
    typeof metaValue.correlationId === "string" &&
    typeof metaValue.externalId === "string" &&
    isObjectRecord(payloadValue)
  ) {
    return {
      meta: {
        correlationId: metaValue.correlationId,
        externalId: metaValue.externalId,
        appSchema: typeof metaValue.appSchema === "string" ? metaValue.appSchema : null,
        traceparent: typeof metaValue.traceparent === "string" ? metaValue.traceparent : null,
        tracestate: typeof metaValue.tracestate === "string" ? metaValue.tracestate : null,
        jobRunId: typeof metaValue.jobRunId === "string" ? metaValue.jobRunId : null,
        parentJobRunId: typeof metaValue.parentJobRunId === "string" ? metaValue.parentJobRunId : null,
        rootJobRunId: typeof metaValue.rootJobRunId === "string" ? metaValue.rootJobRunId : null,
        batchId: typeof metaValue.batchId === "string" ? metaValue.batchId : null,
      },
      payload: payloadValue,
    };
  }

  const fallbackCorrelation =
    typeof payload.correlationId === "string"
      ? payload.correlationId
      : typeof payload._correlationId === "string"
        ? payload._correlationId
        : "unknown";
  const fallbackExternalId = typeof payload.id === "string" ? payload.id : "unknown";

  return {
    meta: {
      correlationId: fallbackCorrelation,
      externalId: fallbackExternalId,
      appSchema: null,
      traceparent: null,
      tracestate: null,
      jobRunId: null,
      parentJobRunId: null,
      rootJobRunId: null,
      batchId: null,
    },
    payload,
  };
};

const toTelemetryLevel = (level: LogLevel): "debug" | "info" | "warn" | "error" => {
  if (level === "error") {
    return "error";
  }
  if (level === "warning") {
    return "warn";
  }
  if (level === "debug") {
    return "debug";
  }

  return "info";
};

const createGraphileLogger = (): Logger => {
  const logFactory: LogFunctionFactory = (scope) => {
    return (level, message) => {
      emitTelemetryLog(toTelemetryLevel(level), "graphile.worker.log", {
        event: "graphile.worker.log",
        graphile_level: level,
        graphile_scope_label: scope.label,
        graphile_worker_id: scope.workerId,
        graphile_task_identifier: scope.taskIdentifier,
        graphile_job_id: scope.jobId,
        graphile_message: message,
      });
    };
  };

  return new Logger(logFactory);
};

export const createGraphileJobQueueClient = (config: GraphileJobQueueConfig): JobQueueClient => {
  let runner: Runner | undefined;
  let preparePromise: Promise<void> | undefined;
  const events = new EventEmitter() as WorkerEvents;
  const logger = createGraphileLogger();
  const addJobFunction = sql.raw(`"${config.schema}"."add_job"`);

  events.on("pool:listen:error", ({ error }) => {
    emitTelemetryLog("error", "graphile.pool_listen_error", {
      event: "graphile.pool_listen_error",
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  events.on("worker:fatalError", ({ error, jobError }) => {
    emitTelemetryLog("error", "graphile.worker_fatal_error", {
      event: "graphile.worker_fatal_error",
      reason: error instanceof Error ? error.message : String(error),
      job_error_reason: jobError instanceof Error ? jobError.message : String(jobError),
    });
  });

  events.on("job:failed", ({ job, error }) => {
    emitTelemetryLog("warn", "graphile.job_failed", {
      event: "graphile.job_failed",
      backend_job_id: job.id,
      job_type: job.task_identifier,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  const prepare = async (): Promise<void> => {
    if (preparePromise) {
      await preparePromise;
      return;
    }

    preparePromise = (async () => {
      const pool = new Pool({
        connectionString: config.databaseUrl,
        max: 1,
      });

      try {
        const result = await pool.query<{ jobs_table: string | null }>("select to_regclass($1) as jobs_table", [
          `${config.schema}._private_jobs`,
        ]);

        if (!result.rows[0]?.jobs_table) {
          throw new Error(`Graphile queue schema "${config.schema}" is not bootstrapped. Run app:bootstrap first.`);
        }
      } finally {
        await pool.end();
      }
    })();

    await preparePromise;
  };

  const enqueue = async (
    db: AppDbLike,
    input: EnqueueJobInput,
    options: QueueEnqueueOptions = {},
  ): Promise<QueueEnqueueResult> => {
    await prepare();

    const envelope = toPayloadEnvelope(input, config.schemaOverrideEnabled ? options : {});
    const payloadJson = JSON.stringify(envelope);
    const runAt = input.availableAt ?? new Date();

    const result = await db.execute(sql`
      select (${addJobFunction}(
        identifier := ${input.jobType},
        payload := ${payloadJson}::json,
        queue_name := ${input.queueName ?? null},
        run_at := ${runAt},
        max_attempts := ${input.maxAttempts ?? null},
        job_key := ${input.jobKey ?? input.id},
        priority := ${input.priority ?? null}
      )).id as backend_job_id
    `);

    const rawBackendJobId = (result as { rows?: Array<{ backend_job_id?: string | number | null }> }).rows?.[0]
      ?.backend_job_id;
    const backendJobId = typeof rawBackendJobId === "number" ? String(rawBackendJobId) : rawBackendJobId;

    if (typeof backendJobId !== "string" || backendJobId.length === 0) {
      throw new Error(`add_job did not return backend job id for external id ${input.id}`);
    }

    return {
      backendJobId,
      runAt,
    };
  };

  const toCronItems = (items: CronScheduleItem[]): CronItem[] =>
    items.map((item) => ({
      task: item.task,
      match: item.schedule,
      payload: item.payload,
      options: {
        backfillPeriod: item.options?.backfillPeriodMs ?? 0,
        maxAttempts: item.options?.maxAttempts,
        queueName: item.options?.queueName,
        priority: item.options?.priority,
      },
      identifier: item.identifier,
    }));

  const startWorker = async (taskRegistry: QueueTaskRegistry, cronSchedule?: CronScheduleItem[]): Promise<void> => {
    await prepare();

    if (runner) {
      return;
    }

    const taskList: TaskList = {};

    for (const [taskIdentifier, handler] of Object.entries(taskRegistry)) {
      taskList[taskIdentifier] = async (payload, helpers): Promise<void> => {
        const envelope = parsePayloadEnvelope(payload);
        const fallbackIdentity = `cron:${taskIdentifier}:${helpers.job.id}`;
        const externalId =
          envelope.meta.externalId.trim().length > 0 && envelope.meta.externalId !== "unknown"
            ? envelope.meta.externalId
            : fallbackIdentity;
        const correlationId =
          envelope.meta.correlationId.trim().length > 0 && envelope.meta.correlationId !== "unknown"
            ? envelope.meta.correlationId
            : fallbackIdentity;
        const rawJob = helpers.job as unknown as Record<string, unknown>;
        const queueName = typeof rawJob.queue_name === "string" ? rawJob.queue_name : null;
        const priority =
          typeof rawJob.priority === "number" && Number.isInteger(rawJob.priority) ? rawJob.priority : null;
        const task: QueueTaskRecord = {
          id: externalId,
          backendJobId: helpers.job.id,
          jobType: taskIdentifier,
          correlationId,
          appSchema: config.schemaOverrideEnabled ? (envelope.meta.appSchema ?? null) : null,
          traceparent: envelope.meta.traceparent ?? null,
          tracestate: envelope.meta.tracestate ?? null,
          jobRunId: envelope.meta.jobRunId ?? null,
          parentJobRunId: envelope.meta.parentJobRunId ?? null,
          rootJobRunId: envelope.meta.rootJobRunId ?? null,
          batchId: envelope.meta.batchId ?? null,
          payload: envelope.payload,
          attempts: helpers.job.attempts,
          maxAttempts: helpers.job.max_attempts,
          runAt: parseDateLike(helpers.job.run_at),
          queueName,
          priority,
        };

        await handler(task);
      };
    }

    const parsedCronItems = cronSchedule?.length ? parseCronItems(toCronItems(cronSchedule)) : undefined;

    runner = await run({
      connectionString: config.databaseUrl,
      schema: config.schema,
      concurrency: config.concurrency,
      pollInterval: config.pollIntervalMs,
      noHandleSignals: true,
      events,
      logger,
      taskList,
      parsedCronItems,
    });
  };

  const stopWorker = async (): Promise<void> => {
    if (!runner) {
      return;
    }

    const activeRunner = runner;
    runner = undefined;
    await activeRunner.stop();
  };

  return {
    prepare,
    enqueue,
    startWorker,
    stopWorker,
  };
};
