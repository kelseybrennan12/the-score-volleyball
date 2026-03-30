import { logs } from "@opentelemetry/api-logs";
import { emitTelemetryLog } from "backend/runtime/adapters/infra/telemetry";
import { afterEach, expect, test, vi } from "vitest";

const parseJsonRecords = (calls: unknown[][]): Array<Record<string, unknown>> => {
  return calls.flatMap((call) => {
    const chunk = call[0];
    if (typeof chunk !== "string" && !(chunk instanceof Uint8Array)) {
      return [];
    }

    const raw = (typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")).trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return [parsed as Record<string, unknown>];
      }
    } catch {
      // Ignore non-JSON writes from unrelated tooling output.
    }

    return [];
  });
};

const getRecordByEvent = (
  records: Array<Record<string, unknown>>,
  event: string,
): Record<string, unknown> | undefined => {
  return records.find((record) => record.event === event);
};

const mockTelemetryLogger = (emitImpl?: (record: unknown) => void) => {
  const emitSpy = vi.fn(emitImpl);
  vi.spyOn(logs, "getLogger").mockReturnValue({ emit: emitSpy } as unknown as ReturnType<typeof logs.getLogger>);
  return emitSpy;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("info logs mirror to stdout and keep OTEL emit behavior", () => {
  const event = "unit.telemetry.stdout.info";
  const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const emitSpy = mockTelemetryLogger();

  vi.stubEnv("OTEL_SERVICE_NAME", "starter-backend");

  emitTelemetryLog("info", "info.body", { event, correlation_id: "corr-123" });

  const stdoutRecords = parseJsonRecords(stdoutWriteSpy.mock.calls as unknown[][]);
  const stderrRecords = parseJsonRecords(stderrWriteSpy.mock.calls as unknown[][]);
  const stdoutRecord = getRecordByEvent(stdoutRecords, event);
  const stderrRecord = getRecordByEvent(stderrRecords, event);

  expect(stdoutRecord).toBeDefined();
  expect(stderrRecord).toBeUndefined();
  expect(stdoutRecord).toMatchObject({
    level: "info",
    severity_text: "INFO",
    body: "info.body",
    service_name: "starter-backend",
    event,
    correlation_id: "corr-123",
  });
  expect(typeof stdoutRecord?.timestamp).toBe("string");

  expect(emitSpy).toHaveBeenCalledTimes(1);
  expect(emitSpy.mock.calls[0]?.[0]).toMatchObject({
    severityText: "INFO",
    body: "info.body",
    attributes: {
      service_name: "starter-backend",
      event,
      correlation_id: "corr-123",
    },
  });
});

test("error logs mirror to stderr", () => {
  const event = "unit.telemetry.stderr.error";
  const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  mockTelemetryLogger();

  vi.stubEnv("OTEL_SERVICE_NAME", "starter-backend");

  emitTelemetryLog("error", "error.body", { event, correlation_id: "corr-err" });

  const stdoutRecords = parseJsonRecords(stdoutWriteSpy.mock.calls as unknown[][]);
  const stderrRecords = parseJsonRecords(stderrWriteSpy.mock.calls as unknown[][]);
  const stdoutRecord = getRecordByEvent(stdoutRecords, event);
  const stderrRecord = getRecordByEvent(stderrRecords, event);

  expect(stdoutRecord).toBeUndefined();
  expect(stderrRecord).toBeDefined();
  expect(stderrRecord).toMatchObject({
    level: "error",
    severity_text: "ERROR",
    body: "error.body",
    service_name: "starter-backend",
    event,
    correlation_id: "corr-err",
  });
});

test("stream mirror still succeeds when OTEL logger emit throws", () => {
  const event = "unit.telemetry.otel.emit.throw";
  const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const emitSpy = mockTelemetryLogger(() => {
    throw new Error("simulated_otel_emit_failure");
  });

  vi.stubEnv("OTEL_SERVICE_NAME", "starter-backend");

  expect(() => emitTelemetryLog("warn", "warn.body", { event })).not.toThrow();

  const stdoutRecords = parseJsonRecords(stdoutWriteSpy.mock.calls as unknown[][]);
  const stderrRecords = parseJsonRecords(stderrWriteSpy.mock.calls as unknown[][]);
  const stdoutRecord = getRecordByEvent(stdoutRecords, event);
  const stderrRecord = getRecordByEvent(stderrRecords, event);

  expect(stdoutRecord).toBeDefined();
  expect(stderrRecord).toBeUndefined();
  expect(emitSpy).toHaveBeenCalledTimes(1);
});

test("stream mirror preserves telemetry truncation, redaction, and attribute limits", () => {
  const event = "unit.telemetry.guards";
  const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  mockTelemetryLogger();
  vi.stubEnv("OTEL_SERVICE_NAME", "starter-backend");

  const attributes: Record<string, unknown> = {
    event,
    correlation_id: "corr-guards",
    api_key: "super-secret",
    long_text: "x".repeat(1100),
  };

  for (let index = 0; index < 70; index += 1) {
    attributes[`key_${index}`] = index;
  }

  emitTelemetryLog("info", "y".repeat(300), attributes);

  const stdoutRecords = parseJsonRecords(stdoutWriteSpy.mock.calls as unknown[][]);
  const stdoutRecord = getRecordByEvent(stdoutRecords, event);

  expect(stdoutRecord).toBeDefined();
  expect(stdoutRecord).toMatchObject({
    level: "info",
    event,
    api_key: "[REDACTED]",
    key_59: 59,
  });
  expect(stdoutRecord?.key_60).toBeUndefined();
  expect(stdoutRecord?.body).toBe(`${"y".repeat(256)}...[truncated 44 chars]`);
  expect(stdoutRecord?.long_text).toBe(`${"x".repeat(1024)}...[truncated 76 chars]`);
});
