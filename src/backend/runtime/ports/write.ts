import type { UserRole } from "backend/runtime/adapters/infra/db/schema";
import type { JobRequestRecord, ReadRepo, UserRecord } from "backend/runtime/ports/read";

export interface JobRunContextInput {
  jobRunId?: string | null;
  parentJobRunId?: string | null;
  rootJobRunId?: string | null;
  batchId?: string | null;
}

export interface EnqueueJobInput {
  id: string;
  jobType: string;
  correlationId: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
  queueName?: string | null;
  maxAttempts?: number | null;
  jobKey?: string | null;
  priority?: number | null;
  runContext?: JobRunContextInput;
}

export interface UpsertUserInput {
  tenantId: string;
  aadObjectId: string;
  email?: string | null;
  displayName?: string | null;
  role?: UserRole;
  isAuthorized?: boolean;
  lastSeenAt?: Date | null;
}

export interface CreateAuthLoginStateInput {
  stateHash: string;
  expiresAt: Date;
  redirectUri?: string | null;
  postLoginRedirect?: string | null;
  postLogoutRedirect?: string | null;
}

export interface ConsumedAuthLoginStateRecord {
  stateHash: string;
  redirectUri: string | null;
  postLoginRedirect: string | null;
  postLogoutRedirect: string | null;
}

export interface CreateAuthSessionInput {
  id: string;
  sessionHash: string;
  tenantId: string;
  aadObjectId: string;
  userId: string;
  claimsJson: Record<string, unknown>;
  refreshTokenCiphertext?: string | null;
  refreshTokenIv?: string | null;
  refreshTokenTag?: string | null;
  accessTokenExpiresAt: Date;
  idleExpiresAt: Date;
  maxExpiresAt: Date;
}

export interface UpdateAuthSessionInput {
  id: string;
  claimsJson?: Record<string, unknown>;
  refreshTokenCiphertext?: string | null;
  refreshTokenIv?: string | null;
  refreshTokenTag?: string | null;
  accessTokenExpiresAt?: Date;
  idleExpiresAt?: Date;
  maxExpiresAt?: Date;
  revokedAt?: Date | null;
}

export interface WriteRepo {
  enqueueJobRequest(input: EnqueueJobInput): Promise<JobRequestRecord>;
  upsertUser(input: UpsertUserInput): Promise<UserRecord>;
  createAuthLoginState(input: CreateAuthLoginStateInput): Promise<void>;
  consumeAuthLoginState(stateHash: string, now?: Date): Promise<ConsumedAuthLoginStateRecord | null>;
  pruneAuthLoginStates(now?: Date): Promise<void>;
  createAuthSession(input: CreateAuthSessionInput): Promise<void>;
  updateAuthSession(input: UpdateAuthSessionInput): Promise<boolean>;
  revokeAuthSessionByHash(sessionHash: string): Promise<void>;
  pruneExpiredAuthSessions(now?: Date): Promise<void>;
}

export interface RepoBundle {
  readRepo: ReadRepo;
  withTransaction<T>(fn: (repos: { readRepo: ReadRepo; writeRepo: WriteRepo }) => Promise<T>): Promise<T>;
}
