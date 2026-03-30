import { ValueType } from "@opentelemetry/api";
import { getMeter } from "backend/runtime/adapters/infra/telemetry";

export interface ApiMetrics {
  recordHttpRequest(method: string, route: string, statusCode: number, durationMs?: number): void;
}

export const createApiMetrics = (): ApiMetrics => {
  const meter = getMeter("starter-api");
  const requestCounter = meter.createCounter("starter_api_http_requests", {
    description: "Total API requests",
    valueType: ValueType.INT,
  });

  const requestDuration = meter.createHistogram("starter_api_http_request_duration_ms", {
    description: "API request duration in milliseconds",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });

  return {
    recordHttpRequest: (method: string, route: string, statusCode: number, durationMs: number = 0) => {
      const dimensions = {
        method,
        route,
        status_code: String(statusCode),
      };

      requestCounter.add(1, dimensions);
      requestDuration.record(durationMs, dimensions);
    },
  };
};
