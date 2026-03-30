import { buildTrpcErrorLogPayload, getRequestLogClassification } from "backend/runtime/bootstrap/api-http-runtime";
import { expect, test } from "vitest";

test("request log classification keeps success responses as info/completed", () => {
  expect(getRequestLogClassification(200)).toEqual({
    level: "info",
    event: "api.request_completed",
  });
  expect(getRequestLogClassification(302)).toEqual({
    level: "info",
    event: "api.request_completed",
  });
});

test("request log classification maps 4xx to warn/completed", () => {
  expect(getRequestLogClassification(404)).toEqual({
    level: "warn",
    event: "api.request_completed",
  });
});

test("request log classification maps 5xx to error/failed", () => {
  expect(getRequestLogClassification(500)).toEqual({
    level: "error",
    event: "api.request_failed",
  });
  expect(getRequestLogClassification(503)).toEqual({
    level: "error",
    event: "api.request_failed",
  });
});

test("trpc error payload includes diagnostic keys and defaults", () => {
  expect(
    buildTrpcErrorLogPayload({
      requestId: "req-1",
      method: "POST",
      route: "/trpc",
      correlationId: "corr-1",
      reason: "boom",
      trpcPath: "jobs.enqueueExample",
      trpcType: "mutation",
      trpcCode: "INTERNAL_SERVER_ERROR",
      traceId: "trace-1",
      spanId: "span-1",
    }),
  ).toMatchObject({
    event: "api.trpc_request_failed",
    request_id: "req-1",
    method: "POST",
    route: "/trpc",
    correlation_id: "corr-1",
    trpc_path: "jobs.enqueueExample",
    trpc_type: "mutation",
    trpc_code: "INTERNAL_SERVER_ERROR",
    reason: "boom",
    trace_id: "trace-1",
    span_id: "span-1",
  });

  expect(
    buildTrpcErrorLogPayload({
      requestId: "req-2",
      method: "GET",
      route: "/trpc",
      correlationId: "corr-2",
      reason: "missing",
    }),
  ).toMatchObject({
    trpc_path: "unknown",
    trpc_type: "unknown",
    trpc_code: "unknown",
  });
});
