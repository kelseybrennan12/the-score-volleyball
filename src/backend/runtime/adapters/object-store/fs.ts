import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStore } from "./port";

/** Filesystem object store: each key is a file under `root`, so `snapshots/active/x.json` is `<root>/snapshots/active/x.json`. */
export function createFsObjectStore(root: string): ObjectStore {
  const filePath = (key: string) => path.join(root, ...key.split("/"));

  async function walk(dir: string, relative: string, out: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const key = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), key, out);
      else out.push(key);
    }
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        return JSON.parse(await readFile(filePath(key), "utf8")) as T;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async put(key, body) {
      const target = filePath(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(body, null, 2) + "\n", "utf8");
    },
    async delete(keys) {
      for (const key of keys) await rm(filePath(key), { force: true });
    },
    async list(prefix) {
      // Walk from the deepest directory the prefix names, then filter on the full key.
      const slash = prefix.lastIndexOf("/");
      const dirKey = slash >= 0 ? prefix.slice(0, slash) : "";
      const keys: string[] = [];
      await walk(dirKey ? filePath(dirKey) : root, dirKey, keys);
      return keys.filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
