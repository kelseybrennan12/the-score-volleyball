/**
 * The storage seam under the snapshot and announcement stores: JSON objects addressed by key. Keys are `/`-separated
 * and identical across backends (e.g. `snapshots/active/spring-sundays.json`); adapters own only how a key maps onto
 * a filesystem, a Blob store, or memory.
 */
/** The one on-disk / on-Blob text form of a stored object, shared by every adapter that persists text. */
export function serializeObject(body: unknown): string {
  return JSON.stringify(body, null, 2) + "\n";
}

export interface ObjectStore {
  /** The parsed JSON at `key`, or `null` when nothing is stored there. */
  get<T>(key: string): Promise<T | null>;
  /** Store `body` as JSON at `key`, overwriting anything already there. */
  put(key: string, body: unknown): Promise<void>;
  /** Remove the given keys; keys that do not exist are ignored. */
  delete(keys: string[]): Promise<void>;
  /** Every stored key that starts with `prefix`, sorted ascending. */
  list(prefix: string): Promise<string[]>;
}
