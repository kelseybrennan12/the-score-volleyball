import { normalizeSchemaName } from "backend/runtime/adapters/infra/db/client";
import type { E2eRuntimeConfig } from "backend/runtime/adapters/infra/env";
import {
  createRepoBundleRuntime,
  getRepoBundle,
  type RepoBundleRuntime,
} from "backend/runtime/adapters/infra/repo-bundle";
import type { RepoBundle } from "backend/runtime/ports/write";

type HeaderRecord = Record<string, string | string[] | undefined>;
type RequestRepoBundleCarrier = {
  headers: HeaderRecord;
  repoRuntime?: RepoBundleRuntime;
};

const schemaPoolCache = new Map<string, RepoBundleRuntime>();

const getHeaderValue = (headers: HeaderRecord, headerName: string): string | undefined => {
  const value = headers[headerName];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : undefined;
  }

  return undefined;
};

const parseCookie = (cookieHeader: string | undefined, name: string): string | undefined => {
  if (!cookieHeader) {
    return undefined;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());

  for (const segment of segments) {
    if (!segment) {
      continue;
    }

    const [rawName, ...rest] = segment.split("=");

    if (rawName !== name) {
      continue;
    }

    return rest.join("=") || undefined;
  }

  return undefined;
};

export const resolveE2eSchemaOverride = (headers: HeaderRecord, config: E2eRuntimeConfig): string | null => {
  if (!config.schemaOverrideEnabled) {
    return null;
  }

  const schemaCookieValue = parseCookie(getHeaderValue(headers, "cookie"), config.schemaCookieName);
  return normalizeSchemaName(schemaCookieValue) ?? null;
};

const getOrCreateSchemaRuntime = (schemaName: string): RepoBundleRuntime => {
  const cached = schemaPoolCache.get(schemaName);
  if (cached) {
    return cached;
  }

  const runtime = createRepoBundleRuntime({
    schemaName,
    maxConnections: 3,
  });
  schemaPoolCache.set(schemaName, runtime);
  return runtime;
};

export const attachRequestRepoBundle = (request: RequestRepoBundleCarrier, config: E2eRuntimeConfig): void => {
  if (request.repoRuntime) {
    return;
  }

  const schemaName = resolveE2eSchemaOverride(request.headers, config);
  if (!schemaName) {
    return;
  }

  request.repoRuntime = getOrCreateSchemaRuntime(schemaName);
};

export const closeRequestRepoBundle = async (_request: RequestRepoBundleCarrier): Promise<void> => {
  // Schema pools are shared across requests and live for the process lifetime.
  // They are cleaned up via closeAllSchemaPoolCaches on shutdown.
};

export const closeAllSchemaPoolCaches = async (): Promise<void> => {
  const runtimes = [...schemaPoolCache.values()];
  schemaPoolCache.clear();
  await Promise.all(runtimes.map((runtime) => runtime.close()));
};

export const resolveRequestRepoBundle = (request: RequestRepoBundleCarrier, _config: E2eRuntimeConfig): RepoBundle => {
  return request.repoRuntime?.repos ?? getRepoBundle();
};
