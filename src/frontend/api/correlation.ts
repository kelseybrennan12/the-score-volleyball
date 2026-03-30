const createFallbackCorrelationId = (): string => {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createCorrelationId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createFallbackCorrelationId();
};

export const withCorrelationHeader = (headers?: HeadersInit): Headers => {
  const resolvedHeaders = new Headers(headers);

  if (!resolvedHeaders.has("x-correlation-id")) {
    resolvedHeaders.set("x-correlation-id", createCorrelationId());
  }

  return resolvedHeaders;
};
