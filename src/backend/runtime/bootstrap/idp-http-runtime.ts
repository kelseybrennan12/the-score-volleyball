import type { Span, Tracer } from "@opentelemetry/api";
import {
  attachRequestRepoBundle,
  closeAllSchemaPoolCaches,
  closeRequestRepoBundle,
  resolveRequestRepoBundle,
} from "backend/runtime/adapters/infra/e2e-schema";
import { getIdpConfig } from "backend/runtime/adapters/infra/env";
import {
  createHttpApp,
  getHeaderString,
  sendHtml,
  sendJson,
  sendRedirect,
  startHttpApp,
  stopHttpApp,
} from "backend/runtime/adapters/infra/http-fastify";
import type { RepoBundleRuntime } from "backend/runtime/adapters/infra/repo-bundle";
import {
  emitTelemetryLog,
  getTracer,
  recordSpanError,
  shutdownTelemetry,
  startTelemetry,
} from "backend/runtime/adapters/infra/telemetry";
import { LocalOidcSimulator } from "backend/runtime/bootstrap/idp-simulator";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

type IdpRequest = FastifyRequest & {
  repoRuntime?: RepoBundleRuntime;
};

const authorizeQuerySchema = z.object({
  response_type: z.string().min(1),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  user_id: z.string().optional(),
});

const tokenBodySchema = z.object({
  grant_type: z.string().min(1),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeStringRecord = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== "object") {
    return {};
  }

  const entries = Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
    if (typeof value === "string") {
      return [[key, value] as const];
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return [[key, String(value)] as const];
    }

    return [];
  });

  return Object.fromEntries(entries);
};

const resolveIssuer = (request: Pick<FastifyRequest, "headers">, fallbackIssuer: string): string => {
  const forwardedHost = getHeaderString(request.headers["x-forwarded-host"]);
  const forwardedProto = getHeaderString(request.headers["x-forwarded-proto"]);
  const host = forwardedHost ?? getHeaderString(request.headers.host) ?? "";
  const proto = forwardedProto ?? "http";

  if (!host) {
    return stripTrailingSlash(fallbackIssuer);
  }

  return `${proto}://${host}/_dev/idp`;
};

const withRouteSpan = async <T>(
  tracer: Tracer,
  request: Pick<FastifyRequest, "headers" | "id">,
  spanName: string,
  handler: (span: Span) => Promise<T>,
): Promise<T> => {
  return tracer.startActiveSpan(spanName, async (span) => {
    const correlationId = getHeaderString(request.headers["x-correlation-id"]) ?? request.id;
    span.setAttribute("correlation_id", correlationId);

    try {
      return await handler(span);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus(recordSpanError(error));
      throw error;
    } finally {
      span.end();
    }
  });
};

const withErrorHandling = async (
  request: Pick<FastifyRequest, "headers" | "id">,
  run: () => Promise<void>,
): Promise<{ ok: true } | { ok: false }> => {
  try {
    await run();
    return { ok: true };
  } catch (error) {
    emitTelemetryLog("error", "idp.request_failed", {
      event: "idp.request_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
      correlation_id: getHeaderString(request.headers["x-correlation-id"]) ?? request.id,
    });

    return { ok: false };
  }
};

const getQueryRecord = (request: Pick<FastifyRequest, "query">): Record<string, string> => {
  return normalizeStringRecord(request.query);
};

export interface IdpRuntime {
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

export const createIdpRuntime = (): IdpRuntime => {
  const config = getIdpConfig();
  startTelemetry(config.telemetry);

  const tracer = getTracer("starter-idp");
  const simulator = new LocalOidcSimulator(config.oidc);
  const app = createHttpApp();
  const getRequestRepos = (request: IdpRequest) => resolveRequestRepoBundle(request, config.e2e);

  app.addHook("onRequest", (request, _reply, done) => {
    attachRequestRepoBundle(request as IdpRequest, config.e2e);
    done();
  });

  app.addHook("onResponse", async (request) => {
    await closeRequestRepoBundle(request as IdpRequest);
  });

  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  app.get("/_dev/idp/.well-known/openid-configuration", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const issuer = resolveIssuer(request, config.oidc.issuer);
        sendJson(reply, 200, simulator.getDiscoveryDocument(issuer));
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.get("/_dev/idp/.well-known/openid-configuration/internal", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const internalIssuer = resolveIssuer(request, config.oidc.issuer);
        sendJson(reply, 200, simulator.getDiscoveryDocumentWithEndpointBase(config.oidc.issuer, internalIssuer));
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.get("/_dev/idp/jwks", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        sendJson(reply, 200, simulator.getJwksDocument());
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.get("/_dev/idp/login", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const issuer = resolveIssuer(request, config.oidc.issuer);
        const html = await simulator.renderLoginPage(getRequestRepos(request), getQueryRecord(request), issuer);
        sendHtml(reply, 200, html);
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.get("/_dev/idp/authorize", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const issuer = resolveIssuer(request, config.oidc.issuer);
        const parsed = authorizeQuerySchema.safeParse(getQueryRecord(request));

        if (!parsed.success) {
          sendJson(reply, 400, { error: "invalid_request" });
          return;
        }

        const authorizeResult = await simulator.authorizeUser(getRequestRepos(request), parsed.data, issuer);

        if (authorizeResult.type === "error") {
          sendJson(reply, authorizeResult.statusCode, { error: authorizeResult.error });
          return;
        }

        sendRedirect(reply, authorizeResult.location);
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.post("/_dev/idp/token", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const bodyText = typeof request.body === "string" ? request.body : "";
        const body = normalizeStringRecord(Object.fromEntries(new URLSearchParams(bodyText).entries()));
        const parsed = tokenBodySchema.safeParse(body);

        if (!parsed.success) {
          sendJson(reply, 400, { error: "invalid_request" });
          return;
        }

        const tokenResponse = await simulator.exchangeToken(parsed.data);
        sendJson(reply, tokenResponse.statusCode, tokenResponse.body);
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.get("/_dev/idp/endsession", async (request, reply) => {
    const result = await withErrorHandling(request, async () => {
      await withRouteSpan(tracer, request, "idp.request", async () => {
        const query = getQueryRecord(request);
        const redirectUri = query.post_logout_redirect_uri;

        if (redirectUri) {
          sendRedirect(reply, redirectUri);
        } else {
          sendHtml(reply, 200, "<!doctype html><html><body><p>Logged out.</p></body></html>");
        }
      });
    });

    if (!result.ok) {
      sendJson(reply, 500, { error: "internal_server_error" });
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    sendJson(reply, 404, { error: "not_found" });
  });

  const start = async (): Promise<void> => {
    try {
      await startHttpApp(app, config.port);

      emitTelemetryLog("info", "idp.started", { event: "idp.started", port: config.port });
    } catch (error) {
      emitTelemetryLog("error", "idp.start_failed", { event: "idp.start_failed" });
      throw error;
    }
  };

  const shutdown = async (): Promise<void> => {
    await stopHttpApp(app);
    await closeAllSchemaPoolCaches();

    emitTelemetryLog("info", "idp.stopped", { event: "idp.stopped" });
    await shutdownTelemetry();
  };

  return { start, shutdown };
};
