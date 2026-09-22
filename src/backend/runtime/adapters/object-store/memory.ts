import type { ObjectStore } from "./port";

/** In-memory object store: the adapter every store test runs against. */
export function createMemoryObjectStore(): ObjectStore {
  const objects = new Map<string, string>();
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = objects.get(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    },
    async put(key, body) {
      objects.set(key, JSON.stringify(body));
    },
    async delete(keys) {
      for (const key of keys) objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
