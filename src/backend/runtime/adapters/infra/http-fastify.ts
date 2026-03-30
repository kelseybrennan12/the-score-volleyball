import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

type HeaderValue = string | string[] | undefined;

export const createHttpApp = (): FastifyInstance => {
  return Fastify({
    logger: false,
    disableRequestLogging: true,
    // 25 MB max upload (P0009) × 4/3 base64 encoding ≈ 33 MB + JSON overhead.
    // If MAX_DOCUMENT_SIZE_BYTES changes, update this value accordingly.
    bodyLimit: 40_000_000,
    // tRPC fastify adapter mounts as `/trpc/:path`; batched requests place
    // comma-separated procedure names into this single path segment.
    maxParamLength: 5000,
  });
};

export const getHeaderString = (header: HeaderValue): string | undefined => {
  if (typeof header === "string" && header.length > 0) {
    return header;
  }

  if (Array.isArray(header) && typeof header[0] === "string" && header[0].length > 0) {
    return header[0];
  }

  return undefined;
};

export const getRequestPathname = (request: Pick<FastifyRequest, "headers" | "raw">): string => {
  const host = getHeaderString(request.headers.host) ?? "localhost";
  const rawUrl = request.raw.url ?? "/";
  return new URL(rawUrl, `http://${host}`).pathname;
};

export const resolveCorrelationId = (
  request: Pick<FastifyRequest, "headers" | "id"> & { correlationId?: string },
): string => {
  if (typeof request.correlationId === "string" && request.correlationId.length > 0) {
    return request.correlationId;
  }

  const headerValue = getHeaderString(request.headers["x-correlation-id"]);
  if (headerValue) {
    return headerValue;
  }

  if (typeof request.id === "string" && request.id.length > 0) {
    return request.id;
  }

  return randomUUID();
};

export const sendJson = (reply: FastifyReply, statusCode: number, payload: unknown): void => {
  void reply.status(statusCode).type("application/json; charset=utf-8").send(payload);
};

export const sendHtml = (reply: FastifyReply, statusCode: number, html: string): void => {
  void reply.status(statusCode).type("text/html; charset=utf-8").send(html);
};

export const sendRedirect = (reply: FastifyReply, location: string): void => {
  void reply.redirect(location, 302);
};

export const startHttpApp = async (app: FastifyInstance, port: number): Promise<void> => {
  await app.listen({ host: "0.0.0.0", port });
};

export const stopHttpApp = async (app: FastifyInstance): Promise<void> => {
  await app.close();
};
