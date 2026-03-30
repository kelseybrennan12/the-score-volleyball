const MAX_SUMMARY_CHARS = 500;
const MAX_ERROR_MESSAGE_CHARS = 8_000;
const MAX_ERROR_STACK_CHARS = 32_000;
const MAX_JSON_STRING_CHARS = 8_000;
const MAX_JSON_DEPTH = 6;
const MAX_JSON_ARRAY_ITEMS = 100;
const MAX_JSON_OBJECT_KEYS = 120;
const MAX_ERROR_CAUSE_DEPTH = 5;

const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...[truncated ${value.length - maxChars} chars]`;
};

const toJsonSafeValue = (value: unknown, depth: number): unknown => {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "string") {
    return truncateText(value, MAX_JSON_STRING_CHARS);
  }

  if (value === undefined) {
    return "[undefined]";
  }

  if (depth >= MAX_JSON_DEPTH) {
    return "[max_depth_reached]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_JSON_ARRAY_ITEMS).map((item) => toJsonSafeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_JSON_OBJECT_KEYS);
    return Object.fromEntries(entries.map(([key, nested]) => [key, toJsonSafeValue(nested, depth + 1)]));
  }

  return truncateText(String(value), MAX_JSON_STRING_CHARS);
};

const serializeUnknownError = (error: unknown, depth: number): unknown => {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: truncateText(error.message, MAX_ERROR_MESSAGE_CHARS),
      stack: error.stack ? truncateText(error.stack, MAX_ERROR_STACK_CHARS) : null,
    };

    if (depth < MAX_ERROR_CAUSE_DEPTH && error.cause !== undefined) {
      serialized.cause = serializeUnknownError(error.cause, depth + 1);
    }

    return serialized;
  }

  return toJsonSafeValue(error, 0);
};

export const summarizeUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    const name = error.name.trim() || "Error";
    const message = error.message.trim() || "unknown_error";
    return truncateText(`${name}: ${message}`, MAX_SUMMARY_CHARS);
  }

  return truncateText(String(toJsonSafeValue(error, 0)), MAX_SUMMARY_CHARS);
};

export const buildJobFailureBlobPayload = (
  error: unknown,
  context: Record<string, unknown>,
): { summary: string; payload: Record<string, unknown> } => {
  return {
    summary: summarizeUnknownError(error),
    payload: {
      capturedAt: new Date().toISOString(),
      context: toJsonSafeValue(context, 0),
      error: serializeUnknownError(error, 0),
    },
  };
};
