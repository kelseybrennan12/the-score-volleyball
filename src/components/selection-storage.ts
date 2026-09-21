import type { StoredSelection } from "@/shared/domain/viewer-selection";

export const SELECTION_STORAGE_KEY = "volleyball-viewer:selection";

/** Storage seam for the remembered Viewer selection: browser local storage in the app, an in-memory adapter in tests. */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const localStorageAdapter: StorageAdapter = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
};

export function createMemoryStorage(
  initial: Record<string, string> = {},
): StorageAdapter & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

/** Read the remembered selection; a missing, unreadable, or corrupt entry reads as nothing remembered. */
export function readStoredSelection(storage: StorageAdapter): StoredSelection | null {
  try {
    const raw = storage.get(SELECTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSelection) : null;
  } catch {
    return null;
  }
}

/** Remember a selection, or forget it when `write` is null. Storage failures (quota, private mode) are swallowed. */
export function writeStoredSelection(storage: StorageAdapter, write: StoredSelection | null): void {
  try {
    if (write == null) storage.remove(SELECTION_STORAGE_KEY);
    else storage.set(SELECTION_STORAGE_KEY, JSON.stringify(write));
  } catch {
    // Swallow storage failures (quota, private mode).
  }
}
