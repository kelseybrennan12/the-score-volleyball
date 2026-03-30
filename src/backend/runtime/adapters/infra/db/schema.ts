import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user", "unverified"]);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const users = pgTable(
  "system_users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    aadObjectId: text("aad_object_id").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    role: userRoleEnum("role").notNull().default("unverified"),
    isAuthorized: boolean("is_authorized").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("system_users_tenant_oid_unique").on(table.tenantId, table.aadObjectId)],
);

export const authSessions = pgTable(
  "system_auth_sessions",
  {
    id: text("id").primaryKey(),
    sessionHash: text("session_hash").notNull(),
    tenantId: text("tenant_id").notNull(),
    aadObjectId: text("aad_object_id").notNull(),
    userId: text("user_id").notNull(),
    claimsJson: jsonb("claims_json").$type<Record<string, unknown>>().notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    refreshTokenIv: text("refresh_token_iv"),
    refreshTokenTag: text("refresh_token_tag"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    maxExpiresAt: timestamp("max_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("system_auth_sessions_session_hash_unique").on(table.sessionHash)],
);

export const authLoginStates = pgTable(
  "system_auth_login_states",
  {
    stateHash: text("state_hash").primaryKey(),
    redirectUri: text("redirect_uri"),
    postLoginRedirect: text("post_login_redirect"),
    postLogoutRedirect: text("post_logout_redirect"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("system_auth_login_states_state_hash_unique").on(table.stateHash)],
);
