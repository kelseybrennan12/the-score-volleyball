export type StorageBackend = "fs" | "blob";

/**
 * The one "filesystem or Blob" decision shared by every private-store repository
 * (snapshots and announcements). Blob on Vercel, filesystem locally, with an
 * explicit SNAPSHOT_STORAGE override for either.
 */
export function resolveStorageBackend(): StorageBackend {
  const explicit = process.env.SNAPSHOT_STORAGE?.toLowerCase();
  if (explicit === "fs" || explicit === "blob") return explicit;
  if (process.env.VERCEL === "1") return "blob";
  return "fs";
}

export function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required when SNAPSHOT_STORAGE=blob (or running on Vercel).");
  }
  return token;
}
