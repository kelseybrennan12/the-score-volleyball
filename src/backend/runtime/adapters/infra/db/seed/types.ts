import type { UserRole } from "backend/runtime/adapters/infra/db/schema";

export interface SeedUser {
  tenantId: string;
  aadObjectId: string;
  email?: string | null;
  displayName?: string | null;
  role?: UserRole;
  isAuthorized?: boolean;
}

export interface SeedPack {
  name: string;
  users: SeedUser[];
}
