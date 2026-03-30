import * as schema from "backend/runtime/adapters/infra/db/schema";
import { users } from "backend/runtime/adapters/infra/db/schema";
import { baselineSeedPack } from "backend/runtime/adapters/infra/db/seed/packs/baseline";
import { demoSeedPack } from "backend/runtime/adapters/infra/db/seed/packs/demo";
import type { BootstrapConfig } from "backend/runtime/adapters/infra/env";
import { emitTelemetryLog } from "backend/runtime/adapters/infra/telemetry";
import { drizzle } from "drizzle-orm/node-postgres";
import { runMigrations as runGraphileMigrations } from "graphile-worker";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type SeedPackName = "baseline" | "demo";

const seedPacks = {
  baseline: baselineSeedPack,
  demo: demoSeedPack,
} as const;

const DRIZZLE_MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

interface MigrationJournalEntry {
  tag: string;
  when: number;
}

interface AppMigrationRecord {
  tag: string;
  folderMillis: number;
}

export interface DatabaseBootstrapResult {
  appMigrationHead: AppMigrationRecord | null;
  graphileSchema: string;
  seedPackApplied: SeedPackName | null;
}

const loadAppMigrations = (): AppMigrationRecord[] => {
  const journalPath = path.join(DRIZZLE_MIGRATIONS_DIR, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Missing Drizzle migration journal at ${journalPath}`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: MigrationJournalEntry[];
  };
  const entries = journal.entries ?? [];

  return entries.map((entry) => ({
    tag: entry.tag,
    folderMillis: entry.when,
  }));
};

const getAppMigrationHead = (migrations: AppMigrationRecord[]): AppMigrationRecord | null => {
  const head = migrations.at(-1);
  return head ?? null;
};

const runSeedPack = async (dbPool: Pool, seedPack: SeedPackName): Promise<string> => {
  const db = drizzle(dbPool, { schema });
  const pack = seedPacks[seedPack];

  for (const user of pack.users) {
    const stableId = `${user.tenantId}:${user.aadObjectId}`;
    await db
      .insert(users)
      .values({
        id: stableId,
        tenantId: user.tenantId,
        aadObjectId: user.aadObjectId,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        role: user.role ?? "unverified",
        isAuthorized: user.isAuthorized ?? false,
        isActive: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [users.tenantId, users.aadObjectId],
        set: {
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          role: user.role ?? "unverified",
          isAuthorized: user.isAuthorized ?? false,
          isActive: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  return pack.name;
};

const runBootstrapStage = async <T>(
  stage: "graphile_migrate" | "seed",
  context: {
    graphileSchema: string;
    appMigrationHead: AppMigrationRecord | null;
    imageTag: string | null;
    seedPack: SeedPackName | "none";
  },
  run: () => Promise<T>,
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    emitTelemetryLog("error", "db.bootstrap.stage_failed", {
      event: "db.bootstrap.stage_failed",
      stage,
      error_code: `db_bootstrap_${stage}_failed`,
      image_tag: context.imageTag,
      graphile_schema: context.graphileSchema,
      app_migration_head: context.appMigrationHead?.tag ?? null,
      seed_pack: context.seedPack,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const runDatabaseBootstrap = async (config: BootstrapConfig): Promise<DatabaseBootstrapResult> => {
  const migrations = loadAppMigrations();
  const appMigrationHead = getAppMigrationHead(migrations);

  emitTelemetryLog("info", "db.bootstrap.started", {
    event: "db.bootstrap.started",
    image_tag: config.imageTag,
    graphile_schema: config.graphileSchema,
    app_migration_head: appMigrationHead?.tag ?? null,
    app_migration_created_at: appMigrationHead?.folderMillis ?? null,
    seed_pack: config.seedPack,
  });

  const workPool = new Pool({
    connectionString: config.databaseUrl,
    ...(config.appSchema ? { options: `-csearch_path=${config.appSchema},public` } : {}),
  });

  try {
    const context = {
      graphileSchema: config.graphileSchema,
      appMigrationHead,
      imageTag: config.imageTag,
      seedPack: config.seedPack,
    };

    await runBootstrapStage("graphile_migrate", context, async () => {
      await runGraphileMigrations({
        connectionString: config.databaseUrl,
        schema: config.graphileSchema,
      });
    });

    let seedPackApplied: SeedPackName | null = null;
    const seedPack = config.seedPack;
    if (seedPack !== "none") {
      seedPackApplied = await runBootstrapStage("seed", { ...context, seedPack }, async () => {
        const applied = await runSeedPack(workPool, seedPack);
        return applied as SeedPackName;
      });
    }

    emitTelemetryLog("info", "db.bootstrap.completed", {
      event: "db.bootstrap.completed",
      image_tag: config.imageTag,
      graphile_schema: config.graphileSchema,
      app_migration_head: appMigrationHead?.tag ?? null,
      app_migration_created_at: appMigrationHead?.folderMillis ?? null,
      seed_pack_applied: seedPackApplied,
    });

    return {
      appMigrationHead,
      graphileSchema: config.graphileSchema,
      seedPackApplied,
    };
  } finally {
    await workPool.end();
  }
};
