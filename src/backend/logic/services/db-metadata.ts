import type { DatabaseMetadataRecord } from "backend/runtime/ports/read";
import type { RepoBundle } from "backend/runtime/ports/write";

export interface GetDatabaseMetadataInput {
  limit?: number;
}

export const getDatabaseMetadata = async (
  repos: RepoBundle,
  input: GetDatabaseMetadataInput = {},
): Promise<DatabaseMetadataRecord> => {
  return repos.readRepo.getDatabaseMetadata(input.limit);
};
