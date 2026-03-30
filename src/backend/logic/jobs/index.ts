import { ROOT_CONTEXT, SpanStatusCode, propagation, trace, type Context, type Link } from "@opentelemetry/api";
import { handleExampleDbPingJob } from "backend/logic/jobs/handlers/example-db-ping";
import { getJobsConfig } from "backend/runtime/adapters/infra/env";
import { createHttpApp, sendJson, startHttpApp, stopHttpApp } from "backend/runtime/adapters/infra/http-fastify";
import { getJobQueueClient } from "backend/runtime/adapters/infra/job-queue";
import type { QueueTaskRecord } from "backend/runtime/adapters/infra/jobs/queue-port";
import { createJobsMetrics } from "backend/runtime/adapters/infra/metrics/jobs-metrics";
import { closeRepoBundle, runWithRepoBundleSchema } from "backend/runtime/adapters/infra/repo-bundle";
import {
  emitTelemetryLog,
  getTracer,
  recordSpanError,
  shutdownTelemetry,
  startTelemetry,
} from "backend/runtime/adapters/infra/telemetry";
import type { JobRequestRecord } from "backend/runtime/ports/read";

interface JobLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

const createJobLogger = (): JobLogger => {
  const emit = (level: "info" | "warn" | "error", payload: Record<string, unknown>, message: string): void => {
    const body = typeof payload.event === "string" ? payload.event : message;
    emitTelemetryLog(level, body, payload);
  };

  return {
    info: (payload, message) => {
      emit("info", payload, message);
    },
    warn: (payload, message) => {
      emit("warn", payload, message);
    },
    error: (payload, message) => {
      emit("error", payload, message);
    },
  };
};

const withBaseLogContext = (logger: JobLogger, baseContext: Record<string, unknown>): JobLogger => {
  const enrich = (payload: Record<string, unknown>): Record<string, unknown> => ({
    ...baseContext,
    ...payload,
  });

  return {
    info: (payload, message) => {
      logger.info(enrich(payload), message);
    },
    warn: (payload, message) => {
      logger.warn(enrich(payload), message);
    },
    error: (payload, message) => {
      logger.error(enrich(payload), message);
    },
  };
};

type DomainJobHandler = (job: JobRequestRecord, deps: { logger: JobLogger }) => Promise<void>;

const domainJobHandlers: Record<string, DomainJobHandler> = {
  "example.db_ping": handleExampleDbPingJob,
};

const toDomainJobRecord = (task: QueueTaskRecord): JobRequestRecord => {
  const now = new Date();

  return {
    id: task.id,
    jobType: task.jobType,
    correlationId: task.correlationId,
    payload: task.payload,
    jobRunId: task.jobRunId,
    parentJobRunId: task.parentJobRunId,
    rootJobRunId: task.rootJobRunId,
    batchId: task.batchId,
    status: "processing",
    attempts: task.attempts,
    lastError: null,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  };
};

const getQueueParentContext = (task: QueueTaskRecord): { parentContext: Context; links?: Link[] } => {
  if (!task.traceparent && !task.tracestate) {
    return { parentContext: ROOT_CONTEXT };
  }

  const carrier: Record<string, string> = {};
  if (task.traceparent) {
    carrier.traceparent = task.traceparent;
  }
  if (task.tracestate) {
    carrier.tracestate = task.tracestate;
  }

  const extractedContext = propagation.extract(ROOT_CONTEXT, carrier);
  const parentSpanContext = trace.getSpanContext(extractedContext);

  return {
    parentContext: extractedContext,
    links: parentSpanContext
      ? [
          {
            context: parentSpanContext,
            attributes: {
              "link.type": "queue_parent",
            },
          },
        ]
      : undefined,
  };
};

const createTaskHandler = (deps: {
  logger: JobLogger;
  metrics: ReturnType<typeof createJobsMetrics>;
  jobType: string;
  domainHandler: DomainJobHandler;
}): ((task: QueueTaskRecord) => Promise<void>) => {
  const tracer = getTracer("starter-jobs");

  return async (task: QueueTaskRecord): Promise<void> => {
    const runTask = async (): Promise<void> => {
      const { parentContext, links } = getQueueParentContext(task);

      await tracer.startActiveSpan("jobs.runner.process_one", { links }, parentContext, async (span) => {
        const startedAt = Date.now();
        const spanContext = span.spanContext();
        const taskLogger = withBaseLogContext(deps.logger, {
          correlation_id: task.correlationId,
          job_id: task.id,
          backend_job_id: task.backendJobId,
          job_run_id: task.jobRunId,
          parent_job_run_id: task.parentJobRunId,
          root_job_run_id: task.rootJobRunId,
          batch_id: task.batchId,
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
          job_type: task.jobType,
          attempts: task.attempts,
          max_attempts: task.maxAttempts,
        });

        span.setAttribute("job.id", task.id);
        span.setAttribute("job.type", task.jobType);
        span.setAttribute("job.backend_id", task.backendJobId);
        span.setAttribute("correlation_id", task.correlationId);

        if (task.jobRunId) {
          span.setAttribute("job.run_id", task.jobRunId);
        }
        if (task.rootJobRunId) {
          span.setAttribute("job.root_run_id", task.rootJobRunId);
        }
        if (task.parentJobRunId) {
          span.setAttribute("job.parent_run_id", task.parentJobRunId);
        }
        if (task.batchId) {
          span.setAttribute("job.batch_id", task.batchId);
        }

        deps.metrics.markClaimed(deps.jobType);
        const queueWaitMs = task.runAt ? Math.max(0, startedAt - task.runAt.getTime()) : 0;
        deps.metrics.recordQueueWait(deps.jobType, queueWaitMs);

        taskLogger.info(
          {
            event: "job.claimed",
            queue_wait_ms: queueWaitMs,
          },
          "claimed job",
        );

        try {
          await deps.domainHandler(toDomainJobRecord(task), { logger: taskLogger });
          const durationMs = Date.now() - startedAt;
          deps.metrics.markProcessed(deps.jobType);
          deps.metrics.recordDuration(deps.jobType, "completed", durationMs);

          taskLogger.info(
            {
              event: "job.completed",
              outcome: "completed",
              duration_ms: durationMs,
            },
            "completed job",
          );

          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const reason = error instanceof Error ? error.message : "unknown_error";
          deps.metrics.markFailed(deps.jobType);
          deps.metrics.recordDuration(deps.jobType, "failed", durationMs);

          taskLogger.error(
            {
              event: "job.dispatch_failed",
              outcome: "failed",
              duration_ms: durationMs,
              reason,
            },
            "domain job dispatch failed",
          );

          span.recordException(error as Error);
          span.setStatus(recordSpanError(error));
          throw error;
        } finally {
          span.end();
        }
      });
    };

    await runWithRepoBundleSchema(task.appSchema, runTask);
  };
};

export interface JobsRuntime {
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

export const createJobsRuntime = (): JobsRuntime => {
  const config = getJobsConfig();
  startTelemetry(config.telemetry);

  const logger = createJobLogger();
  const queueClient = getJobQueueClient();
  const metrics = createJobsMetrics();

  const taskRegistry = Object.fromEntries(
    Object.entries(domainJobHandlers).map(([jobType, domainHandler]) => {
      return [jobType, createTaskHandler({ logger, metrics, jobType, domainHandler })];
    }),
  );

  const app = createHttpApp();
  let workerReady = false;

  app.get("/health", async (_request, reply) => {
    sendJson(reply, 200, { status: "ok", service: "jobs" });
  });
  app.get("/healthz", async (_request, reply) => {
    sendJson(reply, workerReady ? 200 : 503, {
      status: workerReady ? "ok" : "starting",
      service: "jobs",
      workerReady,
    });
  });
  app.setNotFoundHandler((_request, reply) => {
    sendJson(reply, 404, { error: "not_found" });
  });

  const start = async (): Promise<void> => {
    try {
      workerReady = false;
      await queueClient.prepare();
      await startHttpApp(app, config.port);
      await queueClient.startWorker(taskRegistry);
      workerReady = true;

      logger.info(
        {
          event: "jobs.started",
          port: config.port,
          concurrency: config.concurrency,
          cron_enabled: false,
        },
        "jobs service started",
      );
    } catch (error) {
      logger.error(
        {
          event: "jobs.start_failed",
          reason: error instanceof Error ? error.message : String(error),
        },
        "jobs startup failed",
      );
      throw error;
    }
  };

  const shutdown = async (): Promise<void> => {
    workerReady = false;
    await queueClient.stopWorker();
    await stopHttpApp(app);
    await closeRepoBundle();
    logger.info(
      {
        event: "jobs.stopped",
      },
      "jobs service stopped",
    );
    await shutdownTelemetry();
  };

  return { start, shutdown };
};
