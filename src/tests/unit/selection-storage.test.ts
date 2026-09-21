import {
  createMemoryStorage,
  readStoredSelection,
  SELECTION_STORAGE_KEY,
  writeStoredSelection,
  type StorageAdapter,
} from "@/components/selection-storage";
import { describe, expect, it } from "vitest";

describe("selection storage seam", () => {
  it("round-trips a remembered selection through an in-memory adapter", () => {
    const storage = createMemoryStorage();
    writeStoredSelection(storage, { day: "sunday", leagueSlug: "spring-sundays", teamNumber: 2 });
    expect(readStoredSelection(storage)).toEqual({ day: "sunday", leagueSlug: "spring-sundays", teamNumber: 2 });
    expect(Object.keys(storage.dump())).toEqual([SELECTION_STORAGE_KEY]);
  });

  it("forgets the selection when asked to write nothing", () => {
    const storage = createMemoryStorage({ [SELECTION_STORAGE_KEY]: JSON.stringify({ day: "monday" }) });
    writeStoredSelection(storage, null);
    expect(readStoredSelection(storage)).toBeNull();
    expect(storage.dump()).toEqual({});
  });

  it("reads nothing when the entry is missing or corrupt", () => {
    expect(readStoredSelection(createMemoryStorage())).toBeNull();
    expect(readStoredSelection(createMemoryStorage({ [SELECTION_STORAGE_KEY]: "{not json" }))).toBeNull();
  });

  it("swallows storage failures on read and write", () => {
    const broken: StorageAdapter = {
      get: () => {
        throw new Error("SecurityError");
      },
      set: () => {
        throw new Error("QuotaExceededError");
      },
      remove: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readStoredSelection(broken)).toBeNull();
    expect(() => writeStoredSelection(broken, { day: "sunday" })).not.toThrow();
    expect(() => writeStoredSelection(broken, null)).not.toThrow();
  });
});
