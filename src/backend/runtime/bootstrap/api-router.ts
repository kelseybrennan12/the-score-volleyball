import { trace } from "@opentelemetry/api";
import { TRPCError, initTRPC } from "@trpc/server";
import { getApiHealth } from "backend/logic/services/api-health";
import { getDatabaseMetadata } from "backend/logic/services/db-metadata";
import { getDatabaseStatus } from "backend/logic/services/db-status";
import { listExampleJobRuns, triggerExampleDbPing } from "backend/logic/services/example-jobs";
import { getSessionMe } from "backend/logic/services/session-me";
import type { AuthManager, AuthenticatedRequestContext } from "backend/runtime/adapters/infra/auth";
import { resolveRequestRepoBundle } from "backend/runtime/adapters/infra/e2e-schema";
import type { E2eRuntimeConfig } from "backend/runtime/adapters/infra/env";
import type { JobRequestRecord } from "backend/runtime/ports/read";
import type { RepoBundle } from "backend/runtime/ports/write";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type HeaderValue = string | string[] | undefined;

interface TrpcRequest {
  headers: Record<string, HeaderValue>;
  correlationId?: string;
  id?: string;
}

const getHeaderString = (header: HeaderValue): string | undefined => {
  if (typeof header === "string" && header.length > 0) {
    return header;
  }

  if (Array.isArray(header) && typeof header[0] === "string" && header[0].length > 0) {
    return header[0];
  }

  return undefined;
};

export interface TrpcContext {
  req: TrpcRequest;
  repos: RepoBundle;
  auth: AuthManager;
  correlationId: string;
  authContext: AuthenticatedRequestContext | null;
  blobStorageContainerName: string;
}

const createCorrelationId = (req: TrpcRequest): string => {
  if (typeof req.correlationId === "string" && req.correlationId.length > 0) {
    return req.correlationId;
  }

  const headerValue = req.headers["x-correlation-id"];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    return headerValue;
  }
  if (typeof req.id === "string" && req.id.length > 0) {
    return req.id;
  }

  return randomUUID();
};

export const createTrpcContext =
  (auth: AuthManager, blobStorageContainerName: string, e2e: E2eRuntimeConfig) =>
  async (opts: { req: TrpcRequest }): Promise<TrpcContext> => {
    const req = opts.req;

    return {
      req,
      repos: resolveRequestRepoBundle(req, e2e),
      auth,
      correlationId: createCorrelationId(req),
      authContext: null,
      blobStorageContainerName,
    };
  };

const collectCauseChain = (err: unknown, maxDepth = 5): string[] => {
  const messages: string[] = [];
  let current = err;
  let depth = 0;

  while (current instanceof Error && depth < maxDepth) {
    messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
    depth++;
  }

  return messages;
};

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    const deeperCauses = collectCauseChain(error.cause).slice(1).filter(Boolean);
    const suffix = deeperCauses.map((message) => `caused by: ${message}`).join(" | ");

    return {
      ...shape,
      message: suffix ? `${shape.message} | ${suffix}` : shape.message,
    };
  },
});

const observedProcedure = t.procedure.use(async ({ ctx, path, type, next }) => {
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    activeSpan.setAttribute("trpc.procedure", path);
    activeSpan.setAttribute("trpc.type", type);
    activeSpan.setAttribute("correlation_id", ctx.correlationId);
  }

  try {
    return await next();
  } catch (error) {
    if (activeSpan) {
      activeSpan.setAttribute("trpc.error", true);
    }

    throw error;
  }
});

const publicProcedure = observedProcedure;
const protectedProcedure = publicProcedure.use(async ({ ctx, path, next }) => {
  const sessionResult = await ctx.auth.requireAuthorizedSession(getHeaderString(ctx.req.headers.cookie), ctx.repos);

  if (!sessionResult.ok) {
    if ("statusCode" in sessionResult && sessionResult.statusCode === 401) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "error" in sessionResult ? sessionResult.error : "unauthenticated",
      });
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "error" in sessionResult ? sessionResult.error : "forbidden",
    });
  }

  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    activeSpan.setAttribute("trpc.authenticated", true);
    activeSpan.setAttribute("trpc.procedure", path);
    activeSpan.setAttribute("tenant_id", sessionResult.context.user.tenantId);
    activeSpan.setAttribute("user_id", sessionResult.context.user.id);
  }

  return next({
    ctx: {
      ...ctx,
      authContext: sessionResult.context,
    },
  });
});

const listDatabaseMetadataInput = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

const listExampleJobRunsInput = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

const toJobMutationResult = (job: JobRequestRecord) => {
  return {
    id: job.id,
    jobRunId: job.jobRunId ?? null,
    parentJobRunId: job.parentJobRunId ?? null,
    rootJobRunId: job.rootJobRunId ?? null,
    batchId: job.batchId ?? null,
    jobType: job.jobType,
    correlationId: job.correlationId,
    status: job.status,
    attempts: job.attempts,
    lastError: job.lastError,
  };
};

export const createApiRouter = (auth: AuthManager) =>
  t.router({
    health: t.router({
      status: publicProcedure.query(async ({ ctx }) => {
        return getApiHealth(ctx.repos);
      }),
    }),
    db: t.router({
      status: protectedProcedure.query(async ({ ctx }) => {
        return getDatabaseStatus(ctx.repos);
      }),
      metadata: protectedProcedure.input(listDatabaseMetadataInput).query(async ({ ctx, input }) => {
        return getDatabaseMetadata(ctx.repos, input);
      }),
    }),
    session: t.router({
      me: protectedProcedure.query(async ({ ctx }) => {
        return getSessionMe(ctx.authContext!);
      }),
    }),
    jobs: t.router({
      enqueueExample: protectedProcedure.mutation(async ({ ctx }) => {
        const job = await triggerExampleDbPing(ctx.repos, ctx.correlationId);
        return toJobMutationResult(job);
      }),
      listRuns: protectedProcedure.input(listExampleJobRunsInput).query(async ({ ctx, input }) => {
        return listExampleJobRuns(ctx.repos, input);
      }),
    }),
  });

export type AppRouter = ReturnType<typeof createApiRouter>;
