import type { SeedPack } from "backend/runtime/adapters/infra/db/seed/types";

export const baselineSeedPack: SeedPack = {
  name: "baseline",
  users: [
    {
      tenantId: "dev-tenant",
      aadObjectId: "user-admin",
      email: "admin@starter.local",
      displayName: "Starter Admin",
      role: "admin",
      isAuthorized: true,
    },
    {
      tenantId: "dev-tenant",
      aadObjectId: "user-operator",
      email: "operator@starter.local",
      displayName: "Starter Operator",
      role: "user",
      isAuthorized: true,
    },
  ],
};
