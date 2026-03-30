import type { UserRole } from "backend/runtime/adapters/infra/db/schema";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface UserRecord {
  id: string;
  tenantId: string;
  aadObjectId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isAuthorized: boolean;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSessionRecord {
  id: string;
  sessionHash: string;
  tenantId: string;
  aadObjectId: string;
  userId: string;
  claimsJson: Record<string, unknown>;
  refreshTokenCiphertext: string | null;
  refreshTokenIv: string | null;
  refreshTokenTag: string | null;
  accessTokenExpiresAt: Date;
  idleExpiresAt: Date;
  maxExpiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRequestRecord {
  id: string;
  jobType: string;
  correlationId: string;
  payload: Record<string, unknown>;
  jobRunId?: string | null;
  parentJobRunId?: string | null;
  rootJobRunId?: string | null;
  batchId?: string | null;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseStatusRecord {
  databaseName: string | null;
  currentSchema: string | null;
  serverTime: Date | null;
  version: string | null;
  graphileSchema: string;
}

export interface DatabaseTableRecord {
  schemaName: string;
  tableName: string;
  tableType: string;
}

export interface DatabaseMetadataRecord {
  schemas: string[];
  tables: DatabaseTableRecord[];
}

export interface GraphileWorkerJobRecord {
  backendJobId: string;
  jobType: string;
  queueName: string | null;
  runAt: Date | null;
  createdAt: Date | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  status: JobStatus;
}

export interface ReadRepo {
  ping(): Promise<void>;
  getDatabaseStatus(): Promise<DatabaseStatusRecord>;
  getDatabaseMetadata(limit?: number): Promise<DatabaseMetadataRecord>;
  listGraphileWorkerJobs(input?: { limit?: number; taskIdentifierPrefix?: string }): Promise<GraphileWorkerJobRecord[]>;
  getAuthSessionByHash(sessionHash: string): Promise<AuthSessionRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  getUserById(id: string): Promise<UserRecord | null>;
}
