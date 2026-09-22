import path from "node:path";
import { createBlobObjectStore } from "./blob";
import { createFsObjectStore } from "./fs";
import type { ObjectStore } from "./port";

type StorageBackend = "fs" | "blob";

/**
 * The one "filesystem or Blob" decision for every store (snapshots and the announcement): Blob on Vercel, the
 * filesystem under `data/` locally, with an explicit SNAPSHOT_STORAGE override for either.
 */
function resolveStorageBackend(): StorageBackend {
  const explicit = process.env.SNAPSHOT_STORAGE?.toLowerCase();
  if (explicit === "fs" || explicit === "blob") return explicit;
  if (process.env.VERCEL === "1") return "blob";
  return "fs";
}

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required when SNAPSHOT_STORAGE=blob (or running on Vercel).");
  }
  return token;
}

/** The object store for this environment. The CLI entries and the app both go through here. */
export function resolveObjectStore(): ObjectStore {
  if (resolveStorageBackend() === "blob") return createBlobObjectStore({ token: requireBlobToken() });
  return createFsObjectStore(path.resolve(process.cwd(), "data"));
}
