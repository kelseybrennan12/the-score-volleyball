import type { AppDb, AppDbLike } from "backend/runtime/adapters/infra/db/client";
import { authLoginStates, authSessions, users } from "backend/runtime/adapters/infra/db/schema";
import { getJobQueueClient } from "backend/runtime/adapters/infra/job-queue";
import type { JobQueueClient } from "backend/runtime/adapters/infra/jobs/queue-port";
import {
  instrumentReadRepo,
  instrumentWriteRepo,
  recordDbTransactionDuration,
} from "backend/runtime/adapters/infra/metrics/repo-metrics";
import { createDrizzleReadRepoFromDb } from "backend/runtime/adapters/repos/drizzle-read";
import type { JobRequestRecord, UserRecord } from "backend/runtime/ports/read";
import type {
  ConsumedAuthLoginStateRecord,
  CreateAuthLoginStateInput,
  CreateAuthSessionInput,
  EnqueueJobInput,
  RepoBundle,
  UpdateAuthSessionInput,
  UpsertUserInput,
  WriteRepo,
} from "backend/runtime/ports/write";
import { and, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";

type UserRow = typeof users.$inferSelect;

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

const enqueueGraphileJob = async (
  db: AppDbLike,
  input: EnqueueJobInput,
  queueClient: JobQueueClient,
  options: CreateDrizzleWriteRepoOptions,
): Promise<JobRequestRecord> => {
  const now = new Date();
  const runAt = input.availableAt ?? now;
  const queueResult = await queueClient.enqueue(db, input, {
    appSchema: options.schemaName ?? null,
  });

  return {
    id: input.id,
    jobType: input.jobType,
    correlationId: input.correlationId,
    payload: input.payload,
    jobRunId: null,
    parentJobRunId: input.runContext?.parentJobRunId ?? null,
    rootJobRunId: input.runContext?.rootJobRunId ?? null,
    batchId: input.runContext?.batchId ?? null,
    status: "pending",
    attempts: 0,
    lastError: null,
    availableAt: queueResult.runAt ?? runAt,
    createdAt: now,
    updatedAt: now,
  };
};

export interface CreateDrizzleWriteRepoOptions {
  jobQueueClient?: JobQueueClient;
  schemaName?: string | null;
}

export const createDrizzleWriteRepoFromDb = (db: AppDbLike, options: CreateDrizzleWriteRepoOptions = {}): WriteRepo => {
  const queueClient = options.jobQueueClient ?? getJobQueueClient();

  return {
    enqueueJobRequest: async (input: EnqueueJobInput): Promise<JobRequestRecord> => {
      return enqueueGraphileJob(db, input, queueClient, options);
    },

    upsertUser: async (input: UpsertUserInput): Promise<UserRecord> => {
      const now = new Date();
      const stableId = `${input.tenantId}:${input.aadObjectId}`;
      const [row] = await db
        .insert(users)
        .values({
          id: stableId,
          tenantId: input.tenantId,
          aadObjectId: input.aadObjectId,
          email: input.email ?? null,
          displayName: input.displayName ?? null,
          role: input.role ?? "unverified",
          isAuthorized: input.isAuthorized ?? false,
          isActive: true,
          lastSeenAt: input.lastSeenAt ?? now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [users.tenantId, users.aadObjectId],
          set: {
            email: input.email ?? null,
            displayName: input.displayName ?? null,
            role: input.role ?? "unverified",
            isAuthorized: input.isAuthorized ?? false,
            isActive: true,
            lastSeenAt: input.lastSeenAt ?? now,
            updatedAt: now,
          },
        })
        .returning();
      return mapUser(row);
    },

    createAuthLoginState: async (input: CreateAuthLoginStateInput): Promise<void> => {
      await db
        .insert(authLoginStates)
        .values({
          stateHash: input.stateHash,
          expiresAt: input.expiresAt,
          redirectUri: input.redirectUri ?? null,
          postLoginRedirect: input.postLoginRedirect ?? null,
          postLogoutRedirect: input.postLogoutRedirect ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: authLoginStates.stateHash,
          set: {
            expiresAt: input.expiresAt,
            redirectUri: input.redirectUri ?? null,
            postLoginRedirect: input.postLoginRedirect ?? null,
            postLogoutRedirect: input.postLogoutRedirect ?? null,
            consumedAt: null,
            updatedAt: new Date(),
          },
        });
    },

    consumeAuthLoginState: async (
      stateHash: string,
      now: Date = new Date(),
    ): Promise<ConsumedAuthLoginStateRecord | null> => {
      const [consumed] = await db
        .update(authLoginStates)
        .set({ consumedAt: now, updatedAt: now })
        .where(
          and(
            eq(authLoginStates.stateHash, stateHash),
            gte(authLoginStates.expiresAt, now),
            isNull(authLoginStates.consumedAt),
          ),
        )
        .returning({
          stateHash: authLoginStates.stateHash,
          redirectUri: authLoginStates.redirectUri,
          postLoginRedirect: authLoginStates.postLoginRedirect,
          postLogoutRedirect: authLoginStates.postLogoutRedirect,
        });
      return consumed ?? null;
    },

    pruneAuthLoginStates: async (now: Date = new Date()): Promise<void> => {
      await db.delete(authLoginStates).where(lte(authLoginStates.expiresAt, now));
    },

    createAuthSession: async (input: CreateAuthSessionInput): Promise<void> => {
      await db.insert(authSessions).values({
        id: input.id,
        sessionHash: input.sessionHash,
        tenantId: input.tenantId,
        aadObjectId: input.aadObjectId,
        userId: input.userId,
        claimsJson: input.claimsJson,
        refreshTokenCiphertext: input.refreshTokenCiphertext ?? null,
        refreshTokenIv: input.refreshTokenIv ?? null,
        refreshTokenTag: input.refreshTokenTag ?? null,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        idleExpiresAt: input.idleExpiresAt,
        maxExpiresAt: input.maxExpiresAt,
        updatedAt: new Date(),
      });
    },

    updateAuthSession: async (input: UpdateAuthSessionInput): Promise<boolean> => {
      const [row] = await db
        .update(authSessions)
        .set({
          ...(input.claimsJson ? { claimsJson: input.claimsJson } : {}),
          ...(input.refreshTokenCiphertext !== undefined
            ? { refreshTokenCiphertext: input.refreshTokenCiphertext }
            : {}),
          ...(input.refreshTokenIv !== undefined ? { refreshTokenIv: input.refreshTokenIv } : {}),
          ...(input.refreshTokenTag !== undefined ? { refreshTokenTag: input.refreshTokenTag } : {}),
          ...(input.accessTokenExpiresAt ? { accessTokenExpiresAt: input.accessTokenExpiresAt } : {}),
          ...(input.idleExpiresAt ? { idleExpiresAt: input.idleExpiresAt } : {}),
          ...(input.maxExpiresAt ? { maxExpiresAt: input.maxExpiresAt } : {}),
          ...(input.revokedAt !== undefined ? { revokedAt: input.revokedAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.id, input.id))
        .returning({ id: authSessions.id });
      return Boolean(row?.id);
    },

    revokeAuthSessionByHash: async (sessionHash: string): Promise<void> => {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(authSessions.sessionHash, sessionHash));
    },

    pruneExpiredAuthSessions: async (now: Date = new Date()): Promise<void> => {
      await db
        .delete(authSessions)
        .where(
          or(
            lte(authSessions.maxExpiresAt, now),
            lte(authSessions.idleExpiresAt, now),
            isNotNull(authSessions.revokedAt),
          ),
        );
    },
  };
};

export interface CreateDrizzleRepoBundleOptions {
  jobQueueClient?: JobQueueClient;
  schemaName?: string | null;
}

export const createDrizzleRepoBundle = (db: AppDb, options: CreateDrizzleRepoBundleOptions = {}): RepoBundle => {
  const readRepo = instrumentReadRepo(createDrizzleReadRepoFromDb(db));

  return {
    readRepo,
    withTransaction: async (fn) => {
      const startedAtMs = Date.now();

      try {
        const result = await db.transaction(async (tx) => {
          const transactionReadRepo = instrumentReadRepo(createDrizzleReadRepoFromDb(tx), true);
          const transactionWriteRepo = instrumentWriteRepo(
            createDrizzleWriteRepoFromDb(tx, {
              jobQueueClient: options.jobQueueClient,
              schemaName: options.schemaName ?? null,
            }),
            true,
          );
          return fn({ readRepo: transactionReadRepo, writeRepo: transactionWriteRepo });
        });

        recordDbTransactionDuration("committed", Date.now() - startedAtMs);
        return result;
      } catch (error) {
        recordDbTransactionDuration("rolled_back", Date.now() - startedAtMs);
        throw error;
      }
    },
  };
};
