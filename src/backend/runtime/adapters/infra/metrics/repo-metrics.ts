import { SpanStatusCode, ValueType } from "@opentelemetry/api";
import { getMeter, getTracer, recordSpanError } from "backend/runtime/adapters/infra/telemetry";
import type { ReadRepo } from "backend/runtime/ports/read";
import type { WriteRepo } from "backend/runtime/ports/write";

type RepoKind = "read" | "write";
type RepoStatus = "ok" | "error";
type DbTransactionStatus = "committed" | "rolled_back";

interface RepoMetrics {
  recordOperation(
    repoKind: RepoKind,
    repoMethod: string,
    status: RepoStatus,
    inTransaction: boolean,
    durationMs: number,
  ): void;
  recordTransaction(status: DbTransactionStatus, durationMs: number): void;
}

let cachedRepoMetrics: RepoMetrics | undefined;

const createRepoMetrics = (): RepoMetrics => {
  const meter = getMeter("starter-repo");
  const repoOperationDuration = meter.createHistogram("starter_repo_operation_duration_ms", {
    description: "Repository operation duration in milliseconds",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });
  const dbTransactionDuration = meter.createHistogram("starter_db_transaction_duration_ms", {
    description: "Database transaction duration in milliseconds",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });

  return {
    recordOperation: (repoKind, repoMethod, status, inTransaction, durationMs) => {
      repoOperationDuration.record(durationMs, {
        repo_kind: repoKind,
        repo_method: repoMethod,
        status,
        in_transaction: String(inTransaction),
      });
    },
    recordTransaction: (status, durationMs) => {
      dbTransactionDuration.record(durationMs, { status });
    },
  };
};

const getRepoMetrics = (): RepoMetrics => {
  if (!cachedRepoMetrics) {
    cachedRepoMetrics = createRepoMetrics();
  }

  return cachedRepoMetrics;
};

const instrumentRepo = <T extends object>(repo: T, config: { repoKind: RepoKind; inTransaction: boolean }): T => {
  const tracer = getTracer("starter-repos");
  const repoMetrics = getRepoMetrics();

  return new Proxy(repo, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return value;
      }

      const repoMethod = String(property);
      return (...args: unknown[]): Promise<unknown> => {
        return tracer.startActiveSpan(`repo.${config.repoKind}.${repoMethod}`, async (span) => {
          const startedAtMs = Date.now();
          span.setAttribute("repo.kind", config.repoKind);
          span.setAttribute("repo.method", repoMethod);
          span.setAttribute("repo.in_transaction", config.inTransaction);

          try {
            const result = await Promise.resolve((value as (...methodArgs: unknown[]) => unknown).apply(target, args));
            repoMetrics.recordOperation(
              config.repoKind,
              repoMethod,
              "ok",
              config.inTransaction,
              Date.now() - startedAtMs,
            );
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            repoMetrics.recordOperation(
              config.repoKind,
              repoMethod,
              "error",
              config.inTransaction,
              Date.now() - startedAtMs,
            );
            span.recordException(error as Error);
            span.setStatus(recordSpanError(error));
            throw error;
          } finally {
            span.end();
          }
        });
      };
    },
  });
};

export const instrumentReadRepo = (repo: ReadRepo, inTransaction = false): ReadRepo => {
  return instrumentRepo(repo, { repoKind: "read", inTransaction });
};

export const instrumentWriteRepo = (repo: WriteRepo, inTransaction = false): WriteRepo => {
  return instrumentRepo(repo, { repoKind: "write", inTransaction });
};

export const recordDbTransactionDuration = (status: DbTransactionStatus, durationMs: number): void => {
  getRepoMetrics().recordTransaction(status, durationMs);
};
