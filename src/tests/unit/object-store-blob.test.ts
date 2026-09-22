import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake of the four @vercel/blob calls the adapter uses. Objects live in `blobs`; `list` pages at `PAGE_SIZE` the
// way the real API pages at its 1000-item limit.
const PAGE_SIZE = 2;
const blobs = new Map<string, string>();
const calls: { put: unknown[][]; del: unknown[][] } = { put: [], del: [] };

vi.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  return {
    BlobNotFoundError,
    get: vi.fn(async (pathname: string) => {
      const body = blobs.get(pathname);
      if (body == null) throw new BlobNotFoundError("does not exist");
      return { statusCode: 200, stream: new Blob([body]).stream() };
    }),
    put: vi.fn(async (pathname: string, body: string, opts: unknown) => {
      calls.put.push([pathname, opts]);
      blobs.set(pathname, body);
      return { pathname };
    }),
    del: vi.fn(async (pathnames: string | string[]) => {
      calls.del.push([pathnames]);
      for (const p of Array.isArray(pathnames) ? pathnames : [pathnames]) blobs.delete(p);
    }),
    list: vi.fn(async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const all = [...blobs.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + PAGE_SIZE);
      const hasMore = start + PAGE_SIZE < all.length;
      return {
        blobs: page.map((pathname) => ({ pathname })),
        hasMore,
        cursor: hasMore ? String(start + PAGE_SIZE) : undefined,
      };
    }),
  };
});

const { createBlobObjectStore } = await import("@/backend/runtime/adapters/object-store/blob");

describe("blob object store", () => {
  beforeEach(() => {
    blobs.clear();
    calls.put.length = 0;
    calls.del.length = 0;
  });

  it("reads a missing key as null instead of surfacing the SDK's not-found error", async () => {
    const store = createBlobObjectStore({ token: "t" });
    expect(await store.get("snapshots/active/missing.json")).toBeNull();
  });

  it("writes JSON at the key with deterministic, overwritable, private options and reads it back", async () => {
    const store = createBlobObjectStore({ token: "t" });
    await store.put("snapshots/active/a.json", { n: 1 });
    expect(await store.get("snapshots/active/a.json")).toEqual({ n: 1 });
    expect(calls.put[0][0]).toBe("snapshots/active/a.json");
    expect(calls.put[0][1]).toMatchObject({
      access: "private",
      token: "t",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  });

  it("pages through list results past the SDK's page size and returns keys sorted", async () => {
    const store = createBlobObjectStore({ token: "t" });
    for (const n of [3, 1, 5, 2, 4]) await store.put(`snapshots/archive/x/x-${n}.json`, {});
    await store.put("snapshots/active/x.json", {});
    expect(await store.list("snapshots/archive/x/")).toEqual(
      [1, 2, 3, 4, 5].map((n) => `snapshots/archive/x/x-${n}.json`),
    );
    expect(await store.list("nothing/")).toEqual([]);
  });

  it("deletes many keys in one SDK call and skips the call for an empty list", async () => {
    const store = createBlobObjectStore({ token: "t" });
    await store.put("a.json", {});
    await store.put("b.json", {});
    await store.delete(["a.json", "b.json"]);
    await store.delete([]);
    expect(calls.del).toEqual([[["a.json", "b.json"]]]);
    expect(await store.list("")).toEqual([]);
  });
});
