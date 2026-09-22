import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import { serializeObject, type ObjectStore } from "./port";

const ACCESS = "private" as const;

export interface BlobObjectStoreOptions {
  token: string;
}

/**
 * True when a Blob read failed because the object does not exist. The SDK throws BlobNotFoundError in most cases but a
 * bare Error whose message includes "does not exist" in others, so both are treated as "not found".
 */
function isBlobNotFound(err: unknown): boolean {
  if (err instanceof BlobNotFoundError) return true;
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.includes("does not exist");
}

/** Vercel Blob object store: keys are Blob pathnames in the private store behind `token`. */
export function createBlobObjectStore({ token }: BlobObjectStoreOptions): ObjectStore {
  const writeOpts = {
    access: ACCESS,
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  };

  return {
    async get<T>(key: string): Promise<T | null> {
      let result;
      try {
        result = await get(key, { access: ACCESS, token, useCache: false });
      } catch (err) {
        if (isBlobNotFound(err)) return null;
        throw err;
      }
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return JSON.parse(await new Response(result.stream).text()) as T;
    },
    async put(key, body) {
      await put(key, serializeObject(body), writeOpts);
    },
    async delete(keys) {
      if (keys.length > 0) await del(keys, { token });
    },
    async list(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, token, cursor, limit: 1000 });
        for (const blob of page.blobs) keys.push(blob.pathname);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return keys.sort();
    },
  };
}
