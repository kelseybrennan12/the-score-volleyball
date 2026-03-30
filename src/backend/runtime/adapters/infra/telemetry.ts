import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { TelemetryConfig } from "backend/runtime/adapters/infra/env";

type LogLevel = "debug" | "info" | "warn" | "error";
type TelemetryAttributeValue = string | number | boolean | null;

const severityByLevel: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const MAX_TELEMETRY_BODY_CHARS = 256;
const MAX_TELEMETRY_ATTR_COUNT = 64;
const MAX_TELEMETRY_ATTR_CHARS = 1024;
const SENSITIVE_ATTRIBUTE_KEY = /(pass(word)?|token|secret|authorization|cookie|set-cookie|api[-_]?key|session)/i;

let sdk: NodeSDK | undefined;
let activeServiceName = "starter-backend";

const parseResourceAttributes = (raw: string): Record<string, string> => {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const [key, ...rest] = entry.split("=");

      if (!key || rest.length === 0) {
        return acc;
      }

      acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const buildOtlpUrl = (baseEndpoint: string, signalPath: string): string => {
  if (baseEndpoint.includes("/v1/")) {
    return baseEndpoint;
  }

  return `${stripTrailingSlash(baseEndpoint)}${signalPath}`;
};

const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...[truncated ${value.length - maxChars} chars]`;
};

const toTelemetryAttributeValue = (key: string, value: unknown): TelemetryAttributeValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (SENSITIVE_ATTRIBUTE_KEY.test(key)) {
    return "[REDACTED]";
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "string") {
    return truncateText(value, MAX_TELEMETRY_ATTR_CHARS);
  }

  try {
    return truncateText(JSON.stringify(value), MAX_TELEMETRY_ATTR_CHARS);
  } catch {
    return truncateText(String(value), MAX_TELEMETRY_ATTR_CHARS);
  }
};

const normalizeTelemetryAttributes = (
  input: Record<string, unknown>,
): Record<string, string | number | boolean | null> => {
  const normalized = new Map<string, TelemetryAttributeValue>();

  for (const [key, value] of Object.entries(input)) {
    if (!key || normalized.size >= MAX_TELEMETRY_ATTR_COUNT) {
      continue;
    }

    const nextValue = toTelemetryAttributeValue(key, value);
    if (nextValue !== undefined) {
      normalized.set(key, nextValue);
    }
  }

  return Object.fromEntries(normalized.entries());
};

const writeFallbackLogRecord = (
  level: LogLevel,
  body: string,
  attributes: Record<string, string | number | boolean | null>,
): void => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    severity_text: level.toUpperCase(),
    body,
    service_name: activeServiceName,
    ...attributes,
  };
  const line = `${JSON.stringify(record)}\n`;
  const stream = level === "error" ? process.stderr : process.stdout;

  try {
    stream.write(line);
  } catch {
    // Avoid throwing from telemetry logging paths.
  }
};

export const startTelemetry = (config: TelemetryConfig): void => {
  if (sdk) {
    return;
  }

  activeServiceName = config.serviceName;
  const baseEndpoint = stripTrailingSlash(config.otlpEndpoint);
  const resourceAttributes = parseResourceAttributes(config.resourceAttributes);

  sdk = new NodeSDK({
    autoDetectResources: false,
    resource: resourceFromAttributes({
      ...resourceAttributes,
      "service.name": config.serviceName,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
    traceExporter: new OTLPTraceExporter({
      url: buildOtlpUrl(baseEndpoint, "/v1/traces"),
      timeoutMillis: config.otlpTimeoutMs,
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: buildOtlpUrl(baseEndpoint, "/v1/metrics"),
          timeoutMillis: config.otlpTimeoutMs,
        }),
        exportIntervalMillis: config.metricExportIntervalMs,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: buildOtlpUrl(baseEndpoint, "/v1/logs"),
          timeoutMillis: config.otlpTimeoutMs,
        }),
      ),
    ],
  });

  sdk.start();
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
};

export const getTracer = (name: string) => trace.getTracer(name);
export const getMeter = (name: string) => metrics.getMeter(name);

export const emitTelemetryLog = (level: LogLevel, body: string, attributes: Record<string, unknown> = {}): void => {
  const normalizedBody = truncateText(body, MAX_TELEMETRY_BODY_CHARS);
  const normalizedAttributes = normalizeTelemetryAttributes(attributes);
  const severityText = level.toUpperCase();

  writeFallbackLogRecord(level, normalizedBody, normalizedAttributes);

  try {
    const logger = logs.getLogger(activeServiceName);
    logger.emit({
      severityNumber: severityByLevel[level],
      severityText,
      body: normalizedBody,
      attributes: {
        service_name: activeServiceName,
        ...normalizedAttributes,
      },
    });
  } catch {
    // OTEL export is best-effort; stream logging remains the durable fallback.
  }
};

export const recordSpanError = (error: unknown): { code: SpanStatusCode; message: string } => {
  if (error instanceof Error) {
    return { code: SpanStatusCode.ERROR, message: error.message };
  }

  return { code: SpanStatusCode.ERROR, message: "unknown_error" };
};
