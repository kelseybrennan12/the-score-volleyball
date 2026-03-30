import type { RepoBundle } from "backend/runtime/ports/write";

export const getApiHealth = async (repos: RepoBundle): Promise<{ status: "ok"; service: "api" }> => {
  await repos.readRepo.ping();
  return { status: "ok", service: "api" };
};
