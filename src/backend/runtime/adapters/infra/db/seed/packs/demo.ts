import { baselineSeedPack } from "backend/runtime/adapters/infra/db/seed/packs/baseline";
import type { SeedPack } from "backend/runtime/adapters/infra/db/seed/types";

export const demoSeedPack: SeedPack = {
  name: "demo",
  users: [
    ...baselineSeedPack.users,
    {
      tenantId: "dev-tenant",
      aadObjectId: "user-observer",
      email: "observer@starter.local",
      displayName: "Starter Observer",
      role: "unverified",
      isAuthorized: false,
    },
  ],
};
