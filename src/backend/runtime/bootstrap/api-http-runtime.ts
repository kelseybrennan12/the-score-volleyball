import cors from "@fastify/cors";
import { trace } from "@opentelemetry/api";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { getApiHealth } from "backend/logic/services/api-health";
import { createAuthManager } from "backend/runtime/adapters/infra/auth";
import {
  attachRequestRepoBundle,
  closeAllSchemaPoolCaches,
  closeRequestRepoBundle,
  resolveRequestRepoBundle,
} from "backend/runtime/adapters/infra/e2e-schema";
import { getApiConfig, getBlobStorageConfig } from "backend/runtime/adapters/infra/env";
import {
  createHttpApp,
  getHeaderString,
  getRequestPathname,
  resolveCorrelationId,
  sendJson,
  sendRedirect,
  startHttpApp,
  stopHttpApp,
} from "backend/runtime/adapters/infra/http-fastify";
import { getJobQueueClient } from "backend/runtime/adapters/infra/job-queue";
import { createApiMetrics } from "backend/runtime/adapters/infra/metrics/api-metrics";
import type { RepoBundleRuntime } from "backend/runtime/adapters/infra/repo-bundle";
import {
  emitTelemetryLog,
  recordSpanError,
  shutdownTelemetry,
  startTelemetry,
} from "backend/runtime/adapters/infra/telemetry";
import { createApiRouter, createTrpcContext, type AppRouter } from "backend/runtime/bootstrap/api-router";
import type { FastifyRequest } from "fastify";

type CorrelatedRequest = FastifyRequest & {
  correlationId?: string;
  routeLabel?: string;
  startedAtMs?: number;
  repoRuntime?: RepoBundleRuntime;
};

type RequestLogLevel = "info" | "warn" | "error";
type RequestLogEvent = "api.request_completed" | "api.request_failed";

export const getRequestLogClassification = (statusCode: number): { level: RequestLogLevel; event: RequestLogEvent } => {
  if (statusCode >= 500) {
    return { level: "error", event: "api.request_failed" };
  }

  if (statusCode >= 400) {
    return { level: "warn", event: "api.request_completed" };
  }

  return { level: "info", event: "api.request_completed" };
};

interface TrpcErrorLogPayloadInput {
  requestId: string;
  method: string;
  route: string;
  correlationId: string;
  reason: string;
  trpcPath?: string;
  trpcType?: string;
  trpcCode?: string;
  traceId?: string;
  spanId?: string;
}

export const buildTrpcErrorLogPayload = (input: TrpcErrorLogPayloadInput): Record<string, unknown> => {
  return {
    event: "api.trpc_request_failed",
    request_id: input.requestId,
    method: input.method,
    route: input.route,
    correlation_id: input.correlationId,
    trace_id: input.traceId,
    span_id: input.spanId,
    trpc_path: input.trpcPath ?? "unknown",
    trpc_type: input.trpcType ?? "unknown",
    trpc_code: input.trpcCode ?? "unknown",
    reason: input.reason,
  };
};

const parseFirstForwardedValue = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const [first] = value.split(",");
  const normalized = first?.trim();
  return normalized ? normalized : null;
};

const resolveRequestOrigin = (request: FastifyRequest, fallbackOrigin: string): string => {
  const forwardedHost = parseFirstForwardedValue(getHeaderString(request.headers["x-forwarded-host"]));
  const forwardedProto = parseFirstForwardedValue(getHeaderString(request.headers["x-forwarded-proto"]));
  const host = forwardedHost ?? getHeaderString(request.headers.host);

  if (!host) {
    return fallbackOrigin;
  }

  const fallbackProtocol = new URL(fallbackOrigin).protocol.replace(":", "");
  const protocol = forwardedProto ?? fallbackProtocol;
  return `${protocol}://${host}`;
};

export interface ApiHttpRuntime {
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

interface CreateApiHttpRuntimeOptions {
  startTelemetry?: boolean;
}

export const createApiHttpRuntime = async (options?: CreateApiHttpRuntimeOptions): Promise<ApiHttpRuntime> => {
  const config = getApiConfig();
  const telemetryStarted = options?.startTelemetry !== false;

  if (telemetryStarted) {
    startTelemetry(config.telemetry);
  }

  const metrics = createApiMetrics();
  const auth = createAuthManager(config.auth);
  const blobConfig = getBlobStorageConfig();
  const getRequestRepos = (request: CorrelatedRequest) => resolveRequestRepoBundle(request, config.e2e);

  const app = createHttpApp();

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, origin === config.frontendOrigin);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-correlation-id"],
  });

  app.addHook("onRequest", (request, reply, done) => {
    const correlatedRequest = request as CorrelatedRequest;
    attachRequestRepoBundle(correlatedRequest, config.e2e);
    correlatedRequest.startedAtMs = Date.now();
    correlatedRequest.routeLabel = getRequestPathname(request);
    correlatedRequest.correlationId = resolveCorrelationId(request);
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
      activeSpan.setAttribute("correlation_id", correlatedRequest.correlationId);
      activeSpan.setAttribute("request_id", request.id);
    }

    reply.header("x-correlation-id", correlatedRequest.correlationId);
    done();
  });

  app.addHook("onResponse", async (request) => {
    await closeRequestRepoBundle(request as CorrelatedRequest);
  });

  app.addHook("preHandler", (request, _reply, done) => {
    const correlatedRequest = request as CorrelatedRequest;
    const pathname = getRequestPathname(request);

    if (pathname === "/trpc" || pathname.startsWith("/trpc/")) {
      correlatedRequest.routeLabel = "/trpc";
    }

    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const correlatedRequest = request as CorrelatedRequest;
    const startedAtMs = correlatedRequest.startedAtMs ?? Date.now();
    const durationMs = Date.now() - startedAtMs;
    const routeLabel = correlatedRequest.routeLabel ?? getRequestPathname(request);
    const correlationId = correlatedRequest.correlationId ?? resolveCorrelationId(request);
    const requestSpanContext = trace.getActiveSpan()?.spanContext();
    const requestLog = getRequestLogClassification(reply.statusCode);

    metrics.recordHttpRequest(request.method.toUpperCase(), routeLabel, reply.statusCode, durationMs);
    emitTelemetryLog(requestLog.level, requestLog.event, {
      event: requestLog.event,
      request_id: request.id,
      method: request.method.toUpperCase(),
      route: routeLabel,
      status_code: reply.statusCode,
      duration_ms: durationMs,
      correlation_id: correlationId,
      trace_id: requestSpanContext?.traceId,
      span_id: requestSpanContext?.spanId,
    });

    done();
  });

  await app.register(fastifyTRPCPlugin<AppRouter>, {
    prefix: "/trpc",
    trpcOptions: {
      router: createApiRouter(auth),
      createContext: createTrpcContext(auth, blobConfig.userUploadsContainerName, config.e2e),
      onError: ({ error, path, type, req }) => {
        const correlatedRequest = req as CorrelatedRequest;
        const activeSpan = trace.getActiveSpan();

        emitTelemetryLog(
          "error",
          "api.trpc_request_failed",
          buildTrpcErrorLogPayload({
            requestId: req.id,
            method: req.method.toUpperCase(),
            route: correlatedRequest.routeLabel ?? "/trpc",
            correlationId: correlatedRequest.correlationId ?? resolveCorrelationId(req),
            traceId: activeSpan?.spanContext().traceId,
            spanId: activeSpan?.spanContext().spanId,
            trpcPath: path,
            trpcType: type,
            trpcCode: error.code,
            reason: error.message,
          }),
        );
      },
    },
  });

  app.get("/healthz", async (_request, reply) => {
    sendJson(reply, 200, { status: "ok", service: "api" });
  });

  app.get("/health", async (request, reply) => {
    const repos = getRequestRepos(request);
    const sessionResult = await auth.requireAuthorizedSession(getHeaderString(request.headers.cookie), repos);

    if (!sessionResult.ok) {
      const statusCode = "statusCode" in sessionResult ? sessionResult.statusCode : 401;
      const error = "error" in sessionResult ? sessionResult.error : "unauthenticated";

      if (statusCode === 401) {
        reply.header("Set-Cookie", auth.buildClearSessionCookie());
      }

      sendJson(reply, statusCode, { error });
      return;
    }

    sendJson(reply, 200, await getApiHealth(repos));
  });

  app.get("/auth/login", async (request, reply) => {
    const requestOrigin = resolveRequestOrigin(request, config.auth.defaultAppOrigin);
    const location = await auth.getLoginRedirectUrl(getRequestRepos(request), { requestOrigin });
    sendRedirect(reply, location);
  });

  app.get("/auth/callback", async (request, reply) => {
    const code =
      typeof request.query === "object" && request.query ? (request.query as Record<string, unknown>).code : undefined;
    const state =
      typeof request.query === "object" && request.query ? (request.query as Record<string, unknown>).state : undefined;

    if (typeof code !== "string" || typeof state !== "string" || !code || !state) {
      reply.header("Set-Cookie", auth.buildClearSessionCookie());
      reply.header("Cache-Control", "no-store");
      sendRedirect(
        reply,
        auth.getLoginErrorRedirectUrl("missing_callback_params", {
          requestOrigin: resolveRequestOrigin(request, config.auth.defaultAppOrigin),
        }),
      );
      return;
    }

    try {
      const login = await auth.completeLoginWithCode({ code, state }, getRequestRepos(request), {
        requestOrigin: resolveRequestOrigin(request, config.auth.defaultAppOrigin),
      });
      reply.header("Set-Cookie", auth.buildSessionCookie(login.sessionId));
      reply.header("Cache-Control", "no-store");
      sendRedirect(reply, login.postLoginRedirect);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      emitTelemetryLog("error", "auth.callback_failed", {
        event: "auth.callback_failed",
        reason,
      });
      reply.header("Set-Cookie", auth.buildClearSessionCookie());
      reply.header("Cache-Control", "no-store");
      sendRedirect(
        reply,
        auth.getLoginErrorRedirectUrl(reason, {
          requestOrigin: resolveRequestOrigin(request, config.auth.defaultAppOrigin),
        }),
      );
    }
  });

  app.get("/auth/session", async (request, reply) => {
    const status = await auth.getSessionStatus(getHeaderString(request.headers.cookie), getRequestRepos(request));

    if (!status.authenticated) {
      sendJson(reply, 401, {
        authenticated: false,
        deploymentEnvironment: config.deploymentEnvironment,
      });
      return;
    }

    sendJson(reply, 200, {
      authenticated: true,
      deploymentEnvironment: config.deploymentEnvironment,
      user: {
        id: status.user.id,
        tenantId: status.user.tenantId,
        aadObjectId: status.user.aadObjectId,
        email: status.user.email,
        displayName: status.user.displayName,
        role: status.user.role,
        isAuthorized: status.user.isAuthorized,
        isActive: status.user.isActive,
      },
    });
  });

  app.get("/auth/logout", async (request, reply) => {
    await auth.clearSession(getHeaderString(request.headers.cookie), getRequestRepos(request));
    reply.header("Set-Cookie", auth.buildClearSessionCookie());
    const location = await auth.getLogoutRedirectUrl({
      requestOrigin: resolveRequestOrigin(request, config.auth.defaultAppOrigin),
    });
    sendRedirect(reply, location);
  });

  app.setNotFoundHandler((request, reply) => {
    const correlatedRequest = request as CorrelatedRequest;
    correlatedRequest.routeLabel = getRequestPathname(request);
    sendJson(reply, 404, { error: "not_found" });
  });

  app.setErrorHandler((error, request, reply) => {
    const correlatedRequest = request as CorrelatedRequest;
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
      activeSpan.recordException(error as Error);
      activeSpan.setStatus(recordSpanError(error));
    }

    emitTelemetryLog("error", "api.request_failed", {
      event: "api.request_failed",
      request_id: request.id,
      method: request.method.toUpperCase(),
      route: correlatedRequest.routeLabel ?? getRequestPathname(request),
      correlation_id: correlatedRequest.correlationId ?? resolveCorrelationId(request),
      trace_id: activeSpan?.spanContext().traceId,
      span_id: activeSpan?.spanContext().spanId,
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    if (!reply.sent) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  const start = async (): Promise<void> => {
    await getJobQueueClient().prepare();
    await startHttpApp(app, config.port);

    emitTelemetryLog("info", "api.started", { event: "api.started", port: config.port });
  };

  const shutdown = async (): Promise<void> => {
    await stopHttpApp(app);
    await closeAllSchemaPoolCaches();

    if (telemetryStarted) {
      emitTelemetryLog("info", "api.stopped", { event: "api.stopped" });
      await shutdownTelemetry();
    }
  };

  return { start, shutdown };
};
