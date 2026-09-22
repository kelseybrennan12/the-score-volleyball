import { LEAGUE_SOURCES } from "@/backend/logic/core/league-sources";
import type { IngestionDeps } from "@/backend/logic/services/ingestion";
import { createSnapshotStore } from "@/backend/logic/services/snapshot-store";
import { createSheetsFetcher } from "@/backend/runtime/adapters/integrations/google-sheets";
import { resolveObjectStore } from "@/backend/runtime/adapters/object-store";

/**
 * The environment's Ingestion wiring: the checked-in source list, the public-XLSX Sheets fetcher, and the Snapshot
 * store on the filesystem or Blob. Throws when Blob is selected without a token. Tests inject their own instead.
 */
export function createIngestionDeps(): IngestionDeps {
  return {
    sources: LEAGUE_SOURCES,
    fetcher: createSheetsFetcher(),
    store: createSnapshotStore(resolveObjectStore()),
  };
}
