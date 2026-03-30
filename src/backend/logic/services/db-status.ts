import type { DatabaseStatusRecord } from "backend/runtime/ports/read";
import type { RepoBundle } from "backend/runtime/ports/write";

export const getDatabaseStatus = async (repos: RepoBundle): Promise<DatabaseStatusRecord> => {
  await repos.readRepo.ping();
  return repos.readRepo.getDatabaseStatus();
};
