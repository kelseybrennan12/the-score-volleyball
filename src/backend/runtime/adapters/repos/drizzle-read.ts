import type { AppDbLike } from "backend/runtime/adapters/infra/db/client";
import { authSessions, users } from "backend/runtime/adapters/infra/db/schema";
import { getGraphileSchema } from "backend/runtime/adapters/infra/env";
import type {
  AuthSessionRecord,
  DatabaseMetadataRecord,
  DatabaseStatusRecord,
  DatabaseTableRecord,
  GraphileWorkerJobRecord,
  ReadRepo,
  UserRecord,
} from "backend/runtime/ports/read";
import { asc, eq, sql } from "drizzle-orm";

type UserRow = typeof users.$inferSelect;
type AuthSessionRow = typeof authSessions.$inferSelect;

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  aadObjectId: row.aadObjectId,
  email: row.email ?? null,
  displayName: row.displayName ?? null,
  role: row.role,
  isAuthorized: row.isAuthorized,
  isActive: row.isActive,
  lastSeenAt: row.lastSeenAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapAuthSession = (row: AuthSessionRow): AuthSessionRecord => ({
  id: row.id,
  sessionHash: row.sessionHash,
  tenantId: row.tenantId,
  aadObjectId: row.aadObjectId,
  userId: row.userId,
  claimsJson: row.claimsJson,
  refreshTokenCiphertext: row.refreshTokenCiphertext ?? null,
  refreshTokenIv: row.refreshTokenIv ?? null,
  refreshTokenTag: row.refreshTokenTag ?? null,
  accessTokenExpiresAt: row.accessTokenExpiresAt,
  idleExpiresAt: row.idleExpiresAt,
  maxExpiresAt: row.maxExpiresAt,
  revokedAt: row.revokedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const normalizeLimit = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.trunc(value ?? fallback)));
};

const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

const GRAPHILE_SCHEMA_IDENTIFIER = ((): string => {
  const raw = getGraphileSchema().trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) {
    return "graphile_worker";
  }
  return raw;
})();

const GRAPHILE_JOBS_VIEW_SQL = sql.raw(`${quoteIdentifier(GRAPHILE_SCHEMA_IDENTIFIER)}.jobs`);

const toIntegerValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
};

const toNullableDateValue = (value: Date | string | null): Date | null => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createDrizzleReadRepoFromDb = (db: AppDbLike): ReadRepo => {
  return {
    ping: async (): Promise<void> => {
      await db.execute("select 1");
    },

    getDatabaseStatus: async (): Promise<DatabaseStatusRecord> => {
      const result = await db.execute(sql`
        select
          current_database() as database_name,
          current_schema() as current_schema,
          now() as server_time,
          version() as version
      `);

      const [row] =
        (
          result as unknown as {
            rows?: Array<{
              database_name: string | null;
              current_schema: string | null;
              server_time: Date | string | null;
              version: string | null;
            }>;
          }
        ).rows ?? [];

      return {
        databaseName: row?.database_name ?? null,
        currentSchema: row?.current_schema ?? null,
        serverTime: row?.server_time ? toNullableDateValue(row.server_time) : null,
        version: row?.version ?? null,
        graphileSchema: GRAPHILE_SCHEMA_IDENTIFIER,
      };
    },

    getDatabaseMetadata: async (limit?: number): Promise<DatabaseMetadataRecord> => {
      const normalizedLimit = normalizeLimit(limit, 50);
      const schemasResult = await db.execute(sql`
        select schema_name
        from information_schema.schemata
        where schema_name not in ('information_schema', 'pg_catalog', 'pg_toast')
        order by schema_name asc
      `);
      const tablesResult = await db.execute(sql`
        select
          table_schema,
          table_name,
          table_type
        from information_schema.tables
        where table_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
        order by table_schema asc, table_name asc
        limit ${normalizedLimit}
      `);

      const schemas =
        (
          schemasResult as unknown as {
            rows?: Array<{ schema_name: string | null }>;
          }
        ).rows
          ?.map((row) => row.schema_name)
          .filter((value): value is string => typeof value === "string" && value.length > 0) ?? [];

      const tables: DatabaseTableRecord[] =
        (
          tablesResult as unknown as {
            rows?: Array<{
              table_schema: string | null;
              table_name: string | null;
              table_type: string | null;
            }>;
          }
        ).rows?.flatMap((row) => {
          if (!row.table_schema || !row.table_name || !row.table_type) {
            return [];
          }

          return [
            {
              schemaName: row.table_schema,
              tableName: row.table_name,
              tableType: row.table_type,
            },
          ];
        }) ?? [];

      return { schemas, tables };
    },

    listGraphileWorkerJobs: async (input?: {
      limit?: number;
      taskIdentifierPrefix?: string;
    }): Promise<GraphileWorkerJobRecord[]> => {
      const normalizedLimit = normalizeLimit(input?.limit, 25);
      const prefix = input?.taskIdentifierPrefix?.trim();
      const prefixPattern = prefix ? `${prefix}%` : null;

      const result = await db.execute(sql`
        select
          jobs.id::text as backend_job_id,
          jobs.task_identifier as job_type,
          jobs.queue_name as queue_name,
          jobs.run_at as run_at,
          jobs.created_at as created_at,
          jobs.attempts::integer as attempts,
          jobs.max_attempts::integer as max_attempts,
          jobs.last_error as last_error,
          case
            when jobs.last_error is not null and jobs.attempts >= jobs.max_attempts then 'failed'
            when jobs.locked_at is not null then 'processing'
            else 'pending'
          end as status
        from ${GRAPHILE_JOBS_VIEW_SQL} as jobs
        where ${prefixPattern === null ? sql`true` : sql`jobs.task_identifier like ${prefixPattern}`}
        order by jobs.run_at desc nulls last, jobs.id desc
        limit ${normalizedLimit}
      `);

      return (
        (
          result as unknown as {
            rows?: Array<{
              backend_job_id: string | number | bigint;
              job_type: string | null;
              queue_name: string | null;
              run_at: Date | string | null;
              created_at: Date | string | null;
              attempts: number | string | bigint;
              max_attempts: number | string | bigint;
              last_error: string | null;
              status: GraphileWorkerJobRecord["status"];
            }>;
          }
        ).rows ?? []
      ).flatMap((row) => {
        if (!row.job_type) {
          return [];
        }

        return [
          {
            backendJobId: String(row.backend_job_id),
            jobType: row.job_type,
            queueName: row.queue_name ?? null,
            runAt: row.run_at ? toNullableDateValue(row.run_at) : null,
            createdAt: row.created_at ? toNullableDateValue(row.created_at) : null,
            attempts: toIntegerValue(row.attempts),
            maxAttempts: Math.max(1, toIntegerValue(row.max_attempts)),
            lastError: row.last_error ?? null,
            status: row.status,
          },
        ];
      });
    },

    getAuthSessionByHash: async (sessionHash: string): Promise<AuthSessionRecord | null> => {
      const [row] = await db.select().from(authSessions).where(eq(authSessions.sessionHash, sessionHash)).limit(1);
      return row ? mapAuthSession(row) : null;
    },

    listUsers: async (): Promise<UserRecord[]> => {
      const rows = await db.select().from(users).orderBy(asc(users.displayName), asc(users.email), asc(users.id));
      return rows.map(mapUser);
    },

    getUserById: async (id: string): Promise<UserRecord | null> => {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ? mapUser(row) : null;
    },
  };
};
