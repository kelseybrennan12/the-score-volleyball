import type { UserRecord } from "backend/runtime/ports/read";
import type { RepoBundle } from "backend/runtime/ports/write";

type UserRole = UserRecord["role"];

export interface AuthenticatedPrincipalInput {
  tenantId: string;
  aadObjectId: string;
  email?: string | null;
  displayName?: string | null;
  role?: UserRole;
  isAuthorized?: boolean;
}

export const upsertAuthenticatedUser = async (
  repos: RepoBundle,
  principal: AuthenticatedPrincipalInput,
): Promise<UserRecord> => {
  return repos.withTransaction(async ({ writeRepo }) => {
    return writeRepo.upsertUser({
      tenantId: principal.tenantId,
      aadObjectId: principal.aadObjectId,
      email: principal.email ?? null,
      displayName: principal.displayName ?? null,
      role: principal.role,
      isAuthorized: principal.isAuthorized,
      lastSeenAt: new Date(),
    });
  });
};

export const listUsersForDevLogin = async (repos: RepoBundle): Promise<UserRecord[]> => {
  return repos.readRepo.listUsers();
};

export const getUserForDevLogin = async (repos: RepoBundle, id: string): Promise<UserRecord | null> => {
  return repos.readRepo.getUserById(id);
};
