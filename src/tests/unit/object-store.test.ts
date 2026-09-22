import { createFsObjectStore } from "@/backend/runtime/adapters/object-store/fs";
import { createMemoryObjectStore } from "@/backend/runtime/adapters/object-store/memory";
import type { ObjectStore } from "@/backend/runtime/adapters/object-store/port";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Factory = () => Promise<{ store: ObjectStore; cleanup: () => Promise<void> }>;

const adapters: [string, Factory][] = [
  ["memory", async () => ({ store: createMemoryObjectStore(), cleanup: async () => {} })],
  [
    "fs",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "object-store-"));
      return { store: createFsObjectStore(root), cleanup: () => rm(root, { recursive: true, force: true }) };
    },
  ],
];

describe.each(adapters)("object store contract: %s", (_name, make) => {
  async function withStore(run: (store: ObjectStore) => Promise<void>): Promise<void> {
    const { store, cleanup } = await make();
    try {
      await run(store);
    } finally {
      await cleanup();
    }
  }

  it("round-trips JSON by key and reads a missing key as null", () =>
    withStore(async (store) => {
      await store.put("snapshots/active/a.json", { hello: "world", n: 1 });
      expect(await store.get<{ hello: string; n: number }>("snapshots/active/a.json")).toEqual({
        hello: "world",
        n: 1,
      });
      expect(await store.get("snapshots/active/missing.json")).toBeNull();
    }));

  it("overwrites an existing key", () =>
    withStore(async (store) => {
      await store.put("announcement.json", { version: 1 });
      await store.put("announcement.json", { version: 2 });
      expect(await store.get("announcement.json")).toEqual({ version: 2 });
    }));

  it("lists keys under a prefix in ascending order, including nested keys and partial-name prefixes", () =>
    withStore(async (store) => {
      await store.put("snapshots/archive/spring-sundays/spring-sundays-2026-04-19-15-06-09.json", {});
      await store.put("snapshots/archive/spring-sundays/spring-sundays-2026-04-19-15-18-48.json", {});
      await store.put("snapshots/archive/spring-mondays/spring-mondays-2026-04-19-15-06-09.json", {});
      await store.put("snapshots/active/spring-sundays.json", {});
      await store.put("snapshots/meta.json", {});
      expect(await store.list("snapshots/archive/spring-sundays/")).toEqual([
        "snapshots/archive/spring-sundays/spring-sundays-2026-04-19-15-06-09.json",
        "snapshots/archive/spring-sundays/spring-sundays-2026-04-19-15-18-48.json",
      ]);
      expect(await store.list("snapshots/archive/")).toHaveLength(3);
      expect(await store.list("snapshots/")).toHaveLength(5);
      expect(await store.list("snapshots/act")).toEqual(["snapshots/active/spring-sundays.json"]);
      expect(await store.list("nothing/")).toEqual([]);
    }));

  it("deletes many keys at once and ignores keys that do not exist", () =>
    withStore(async (store) => {
      await store.put("snapshots/archive/x/x-2026-04-19-15-06-09.json", {});
      await store.put("snapshots/archive/x/x-2026-04-19-15-18-48.json", {});
      await store.delete([
        "snapshots/archive/x/x-2026-04-19-15-06-09.json",
        "snapshots/archive/x/x-2026-04-19-15-18-48.json",
        "snapshots/archive/x/never-existed.json",
      ]);
      await store.delete([]);
      expect(await store.list("snapshots/archive/x/")).toEqual([]);
    }));
});
