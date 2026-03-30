import { z } from "zod";

const NodeEnvSchema = z.enum(["development", "test", "production"]);
type NodeEnv = z.infer<typeof NodeEnvSchema>;
const DeploymentEnvironmentSchema = z.enum(["local", "staging", "prod"]);
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironmentSchema>;

const OtlpProtocolSchema = z.enum(["http/protobuf"]);
type OtlpProtocol = z.infer<typeof OtlpProtocolSchema>;

const SchemaNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

const BooleanFromString = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["true", "false"]))
  .transform((value) => value === "true");

const emptyStringToUndefined = (value: unknown): unknown => {
  return typeof value === "string" && value.trim().length === 0 ? undefined : value;
};

const defaultedNonEmptyString = (fallback: string) => {
  return z.preprocess(emptyStringToUndefined, z.string().min(1).default(fallback));
};

const defaultedPositiveInt = (fallback: number) => {
  return z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().default(fallback));
};

const defaultedOtlpProtocol = (fallback: OtlpProtocol) => {
  return z.preprocess(emptyStringToUndefined, OtlpProtocolSchema.default(fallback));
};

const decodeEncryptionKey = (value: string): Buffer => {
  return Buffer.from(value, "base64");
};

const SharedRuntimeEnvSchema = z.object({
  NODE_ENV: NodeEnvSchema.default("development"),
  LOG_LEVEL: defaultedNonEmptyString("info"),
});

const DbEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_DB_SCHEMA: SchemaNameSchema.default("public"),
});

const E2eRuntimeEnvSchema = z.object({
  APP_E2E_SCHEMA_OVERRIDE_ENABLED: BooleanFromString.default(false),
  APP_E2E_SCHEMA_COOKIE_NAME: z.string().min(1).default("project-starter-e2e-schema"),
});

const TelemetryEnvSchema = z.object({
  OTEL_SERVICE_NAME: defaultedNonEmptyString("starter-backend"),
  OTEL_EXPORTER_OTLP_ENDPOINT: defaultedNonEmptyString("http://alloy:4318"),
  OTEL_EXPORTER_OTLP_PROTOCOL: defaultedOtlpProtocol("http/protobuf"),
  OTEL_RESOURCE_ATTRIBUTES: z.preprocess(
    emptyStringToUndefined,
    z.string().default("deployment.environment=development"),
  ),
  OTEL_METRIC_EXPORT_INTERVAL_MS: defaultedPositiveInt(10000),
  OTEL_EXPORTER_OTLP_TIMEOUT_MS: defaultedPositiveInt(10000),
});

const AuthEnvSchema = z.object({
  AUTH_PROVIDER: z.enum(["entra", "dev"]).default("dev"),
  AUTH_ISSUER: z.url().default("http://localhost:3003/_dev/idp"),
  AUTH_OIDC_METADATA_URL: z.url().optional(),
  AUTH_DEV_BROWSER_ISSUER_NON_LOOPBACK: z.url().optional(),
  AUTH_CLIENT_ID: z.string().min(1).default("project-starter-web"),
  AUTH_CLIENT_SECRET: z.string().default(""),
  AUTH_AUDIENCE: z.string().min(1).default("project-starter-api"),
  AUTH_SCOPE: z.string().min(1).default("openid profile email offline_access"),
  AUTH_TENANT_ID: z.string().min(1).default("dev-tenant"),
  AUTH_REDIRECT_URI: z.preprocess(emptyStringToUndefined, z.url().optional()),
  AUTH_POST_LOGIN_REDIRECT: z.preprocess(emptyStringToUndefined, z.url().optional()),
  AUTH_POST_LOGOUT_REDIRECT: z.preprocess(emptyStringToUndefined, z.url().optional()),
  AUTH_SESSION_COOKIE_NAME: z.string().min(1).default("project-starter-session"),
  AUTH_COOKIE_SECURE: BooleanFromString.default(false),
  AUTH_SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(28_800_000),
  AUTH_SESSION_MAX_LIFETIME_MS: z.coerce.number().int().positive().default(43_200_000),
  AUTH_STATE_TTL_MS: z.coerce.number().int().positive().default(600_000),
  AUTH_SESSION_ENCRYPTION_KEY: z.string().min(1).default("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="),
  AUTH_ADMIN_GROUP_ID: z.string().default(""),
  AUTH_USER_GROUP_ID: z.string().default(""),
});

const BlobStorageEnvSchema = z.object({
  AZURE_STORAGE_ACCOUNT_NAME: z.string().min(1).default("devstoreaccount1"),
  AZURE_CLIENT_ID: z.string().default(""),
  AZURE_USER_UPLOADS_CONTAINER_NAME: z.string().min(1).default("user-uploads"),
});

const EnvSchema = SharedRuntimeEnvSchema.extend(DbEnvSchema.shape)
  .extend(TelemetryEnvSchema.shape)
  .extend(AuthEnvSchema.shape)
  .extend(BlobStorageEnvSchema.shape)
  .extend(E2eRuntimeEnvSchema.shape)
  .extend({
    API_PORT: z.coerce.number().int().positive().default(3000),
    FRONTEND_ORIGIN: z.url().default("http://localhost:5173"),
    APP_DEPLOYMENT_ENV: DeploymentEnvironmentSchema.default("local"),
  });

type ParsedEnv = z.infer<typeof EnvSchema>;

const JobsEnvSchema = SharedRuntimeEnvSchema.extend(DbEnvSchema.shape)
  .extend(TelemetryEnvSchema.shape)
  .extend(E2eRuntimeEnvSchema.shape)
  .extend({
    JOBS_PORT: z.coerce.number().int().positive().default(3001),
    JOBS_POLL_INTERVAL_MS: defaultedPositiveInt(5000),
    JOBS_CONCURRENCY: defaultedPositiveInt(40),
    JOBS_GRAPHILE_SCHEMA: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .default("graphile_worker"),
  });

type ParsedJobsEnv = z.infer<typeof JobsEnvSchema>;

const GraphileSchemaEnvSchema = z.object({
  JOBS_GRAPHILE_SCHEMA: JobsEnvSchema.shape.JOBS_GRAPHILE_SCHEMA,
});

type ParsedGraphileSchemaEnv = z.infer<typeof GraphileSchemaEnvSchema>;

const JobQueueEnvSchema = DbEnvSchema.extend({
  JOBS_POLL_INTERVAL_MS: JobsEnvSchema.shape.JOBS_POLL_INTERVAL_MS,
  JOBS_CONCURRENCY: JobsEnvSchema.shape.JOBS_CONCURRENCY,
  JOBS_GRAPHILE_SCHEMA: JobsEnvSchema.shape.JOBS_GRAPHILE_SCHEMA,
}).extend({
  APP_E2E_SCHEMA_OVERRIDE_ENABLED: E2eRuntimeEnvSchema.shape.APP_E2E_SCHEMA_OVERRIDE_ENABLED,
});

type ParsedJobQueueEnv = z.infer<typeof JobQueueEnvSchema>;

const IdpEnvSchema = SharedRuntimeEnvSchema.extend(DbEnvSchema.shape)
  .extend(TelemetryEnvSchema.shape)
  .extend(AuthEnvSchema.shape)
  .extend(E2eRuntimeEnvSchema.shape)
  .extend({
    IDP_PORT: z.coerce.number().int().positive().default(3003),
    IDP_ISSUER: z.url().default("http://localhost:3003/_dev/idp"),
    IDP_CLIENT_ID: z.string().min(1).default("project-starter-web"),
    IDP_CLIENT_SECRET: z.string().default(""),
    IDP_AUDIENCE: z.string().min(1).default("project-starter-api"),
    IDP_SCOPE: z.string().min(1).default("openid profile email offline_access"),
    IDP_TENANT_ID: z.string().min(1).default("dev-tenant"),
    IDP_ADMIN_GROUP_ID: z.string().default(""),
    IDP_USER_GROUP_ID: z.string().default(""),
  });

type ParsedIdpEnv = z.infer<typeof IdpEnvSchema>;
type ParsedDbEnv = z.infer<typeof DbEnvSchema>;

const MigrationEnvSchema = DbEnvSchema;
type ParsedMigrationEnv = z.infer<typeof MigrationEnvSchema>;
const StartupSeedPackSchema = z.enum(["none", "baseline", "demo"]);
const StartupSeedEnvSchema = DbEnvSchema.extend({
  APP_STARTUP_SEED_PACK: StartupSeedPackSchema.default("none"),
});
type ParsedStartupSeedEnv = z.infer<typeof StartupSeedEnvSchema>;
const BootstrapEnvSchema = SharedRuntimeEnvSchema.extend(DbEnvSchema.shape)
  .extend(TelemetryEnvSchema.shape)
  .extend({
    JOBS_GRAPHILE_SCHEMA: JobsEnvSchema.shape.JOBS_GRAPHILE_SCHEMA,
    APP_STARTUP_SEED_PACK: StartupSeedPackSchema.default("none"),
    APP_IMAGE_TAG: z.string().default(""),
  });
type ParsedBootstrapEnv = z.infer<typeof BootstrapEnvSchema>;

type ParsedTelemetryEnv = z.infer<typeof TelemetryEnvSchema>;

export interface SharedRuntimeConfig {
  nodeEnv: NodeEnv;
  logLevel: string;
}

export interface DbConfig {
  databaseUrl: string;
  appSchema: string | null;
}

export interface TelemetryConfig {
  serviceName: string;
  otlpEndpoint: string;
  otlpProtocol: OtlpProtocol;
  resourceAttributes: string;
  metricExportIntervalMs: number;
  otlpTimeoutMs: number;
}

export interface AuthConfig {
  provider: "entra" | "dev";
  issuer: string;
  oidcMetadataUrl: string;
  devBrowserIssuerNonLoopback: string | null;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
  tenantId: string;
  defaultAppOrigin: string;
  redirectUri: string | null;
  postLoginRedirect: string | null;
  postLogoutRedirect: string | null;
  sessionCookieName: string;
  cookieSecure: boolean;
  sessionIdleTimeoutMs: number;
  sessionMaxLifetimeMs: number;
  stateTtlMs: number;
  sessionEncryptionKey: string;
  adminGroupId: string;
  userGroupId: string;
}

export interface E2eRuntimeConfig {
  schemaOverrideEnabled: boolean;
  schemaCookieName: string;
}

export interface ApiConfig extends SharedRuntimeConfig, DbConfig {
  port: number;
  frontendOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  telemetry: TelemetryConfig;
  auth: AuthConfig;
  e2e: E2eRuntimeConfig;
}

export interface BlobStorageConfig {
  useAzurite: boolean;
  azuriteBlobEndpoint: string;
  storageAccountName: string;
  managedIdentityClientId: string;
  userUploadsContainerName: string;
}

export interface DevIdpConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
  tenantId: string;
  adminGroupId: string;
  userGroupId: string;
}

export interface IdpConfig extends SharedRuntimeConfig, DbConfig {
  port: number;
  telemetry: TelemetryConfig;
  oidc: DevIdpConfig;
  e2e: E2eRuntimeConfig;
}

export interface JobsConfig extends SharedRuntimeConfig, DbConfig {
  port: number;
  pollIntervalMs: number;
  concurrency: number;
  graphileSchema: string;
  telemetry: TelemetryConfig;
  e2e: E2eRuntimeConfig;
}

export interface JobQueueConfig extends DbConfig {
  pollIntervalMs: number;
  concurrency: number;
  graphileSchema: string;
  schemaOverrideEnabled: boolean;
}

export interface StartupSeedConfig extends DbConfig {
  seedPack: z.infer<typeof StartupSeedPackSchema>;
}

export interface BootstrapConfig extends SharedRuntimeConfig, DbConfig {
  graphileSchema: string;
  imageTag: string | null;
  seedPack: z.infer<typeof StartupSeedPackSchema>;
  telemetry: TelemetryConfig;
}

let cachedEnv: ParsedEnv | undefined;

const parseEnv = (): ParsedEnv => {
  if (!cachedEnv) {
    const parsed = EnvSchema.parse(process.env);

    if (parsed.NODE_ENV === "production" && parsed.AUTH_PROVIDER === "dev") {
      throw new Error("AUTH_PROVIDER=dev is not allowed when NODE_ENV=production");
    }

    if (parsed.NODE_ENV === "production" && !parsed.AUTH_COOKIE_SECURE) {
      throw new Error("AUTH_COOKIE_SECURE=true is required when NODE_ENV=production");
    }

    if (decodeEncryptionKey(parsed.AUTH_SESSION_ENCRYPTION_KEY).length !== 32) {
      throw new Error("AUTH_SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes");
    }

    cachedEnv = parsed;
  }

  return cachedEnv;
};

let cachedJobsEnv: ParsedJobsEnv | undefined;

const parseJobsEnv = (): ParsedJobsEnv => {
  if (!cachedJobsEnv) {
    cachedJobsEnv = JobsEnvSchema.parse(process.env);
  }

  return cachedJobsEnv;
};

let cachedGraphileSchemaEnv: ParsedGraphileSchemaEnv | undefined;

const parseGraphileSchemaEnv = (): ParsedGraphileSchemaEnv => {
  if (!cachedGraphileSchemaEnv) {
    const parsed = GraphileSchemaEnvSchema.parse(process.env);

    cachedGraphileSchemaEnv = parsed;
  }

  return cachedGraphileSchemaEnv;
};

let cachedJobQueueEnv: ParsedJobQueueEnv | undefined;

const parseJobQueueEnv = (): ParsedJobQueueEnv => {
  if (!cachedJobQueueEnv) {
    const parsed = JobQueueEnvSchema.parse(process.env);

    cachedJobQueueEnv = parsed;
  }

  return cachedJobQueueEnv;
};

let cachedIdpEnv: ParsedIdpEnv | undefined;

const parseIdpEnv = (): ParsedIdpEnv => {
  if (!cachedIdpEnv) {
    const parsed = IdpEnvSchema.parse(process.env);

    cachedIdpEnv = parsed;
  }

  return cachedIdpEnv;
};

let cachedDbEnv: ParsedDbEnv | undefined;

const parseDbEnv = (): ParsedDbEnv => {
  if (!cachedDbEnv) {
    const parsed = DbEnvSchema.parse(process.env);

    cachedDbEnv = parsed;
  }

  return cachedDbEnv;
};

let cachedMigrationEnv: ParsedMigrationEnv | undefined;

const parseMigrationEnv = (): ParsedMigrationEnv => {
  if (!cachedMigrationEnv) {
    const parsed = MigrationEnvSchema.parse(process.env);

    cachedMigrationEnv = parsed;
  }

  return cachedMigrationEnv;
};

let cachedStartupSeedEnv: ParsedStartupSeedEnv | undefined;

const parseStartupSeedEnv = (): ParsedStartupSeedEnv => {
  if (!cachedStartupSeedEnv) {
    const parsed = StartupSeedEnvSchema.parse(process.env);
    cachedStartupSeedEnv = parsed;
  }

  return cachedStartupSeedEnv;
};

let cachedBootstrapEnv: ParsedBootstrapEnv | undefined;

const parseBootstrapEnv = (): ParsedBootstrapEnv => {
  if (!cachedBootstrapEnv) {
    const parsed = BootstrapEnvSchema.parse(process.env);
    cachedBootstrapEnv = parsed;
  }

  return cachedBootstrapEnv;
};

export const resetEnvironmentConfigCaches = (): void => {
  cachedEnv = undefined;
  cachedJobsEnv = undefined;
  cachedGraphileSchemaEnv = undefined;
  cachedJobQueueEnv = undefined;
  cachedIdpEnv = undefined;
  cachedDbEnv = undefined;
  cachedMigrationEnv = undefined;
  cachedStartupSeedEnv = undefined;
  cachedBootstrapEnv = undefined;
};

const getTelemetryConfig = (env: ParsedTelemetryEnv): TelemetryConfig => {
  return {
    serviceName: env.OTEL_SERVICE_NAME,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpProtocol: env.OTEL_EXPORTER_OTLP_PROTOCOL,
    resourceAttributes: env.OTEL_RESOURCE_ATTRIBUTES,
    metricExportIntervalMs: env.OTEL_METRIC_EXPORT_INTERVAL_MS,
    otlpTimeoutMs: env.OTEL_EXPORTER_OTLP_TIMEOUT_MS,
  };
};

const getAuthConfig = (env: ParsedEnv): AuthConfig => {
  const issuerWithoutTrailingSlash = env.AUTH_ISSUER.replace(/\/+$/, "");
  const frontendOrigin = new URL(env.FRONTEND_ORIGIN);
  return {
    provider: env.AUTH_PROVIDER,
    issuer: env.AUTH_ISSUER,
    oidcMetadataUrl: env.AUTH_OIDC_METADATA_URL ?? `${issuerWithoutTrailingSlash}/.well-known/openid-configuration`,
    devBrowserIssuerNonLoopback: env.AUTH_DEV_BROWSER_ISSUER_NON_LOOPBACK ?? null,
    clientId: env.AUTH_CLIENT_ID,
    clientSecret: env.AUTH_CLIENT_SECRET,
    audience: env.AUTH_AUDIENCE,
    scope: env.AUTH_SCOPE,
    tenantId: env.AUTH_TENANT_ID,
    defaultAppOrigin: `${frontendOrigin.protocol}//${frontendOrigin.host}`,
    redirectUri: env.AUTH_REDIRECT_URI ?? null,
    postLoginRedirect: env.AUTH_POST_LOGIN_REDIRECT ?? null,
    postLogoutRedirect: env.AUTH_POST_LOGOUT_REDIRECT ?? null,
    sessionCookieName: env.AUTH_SESSION_COOKIE_NAME,
    cookieSecure: env.AUTH_COOKIE_SECURE,
    sessionIdleTimeoutMs: env.AUTH_SESSION_IDLE_TIMEOUT_MS,
    sessionMaxLifetimeMs: env.AUTH_SESSION_MAX_LIFETIME_MS,
    stateTtlMs: env.AUTH_STATE_TTL_MS,
    sessionEncryptionKey: env.AUTH_SESSION_ENCRYPTION_KEY,
    adminGroupId: env.AUTH_ADMIN_GROUP_ID,
    userGroupId: env.AUTH_USER_GROUP_ID,
  };
};

const getDevIdpConfig = (env: ParsedIdpEnv): DevIdpConfig => {
  return {
    issuer: env.IDP_ISSUER,
    clientId: env.IDP_CLIENT_ID,
    clientSecret: env.IDP_CLIENT_SECRET,
    audience: env.IDP_AUDIENCE,
    scope: env.IDP_SCOPE,
    tenantId: env.IDP_TENANT_ID,
    adminGroupId: env.IDP_ADMIN_GROUP_ID || env.AUTH_ADMIN_GROUP_ID || "dev-admin-group",
    userGroupId: env.IDP_USER_GROUP_ID || env.AUTH_USER_GROUP_ID || "dev-user-group",
  };
};

const normalizeAppSchema = (value: string): string | null => {
  return value === "public" ? null : value;
};

const getE2eRuntimeConfig = (
  env: Pick<ParsedEnv, "APP_E2E_SCHEMA_OVERRIDE_ENABLED" | "APP_E2E_SCHEMA_COOKIE_NAME">,
): E2eRuntimeConfig => {
  return {
    schemaOverrideEnabled: env.APP_E2E_SCHEMA_OVERRIDE_ENABLED,
    schemaCookieName: env.APP_E2E_SCHEMA_COOKIE_NAME.trim(),
  };
};

const withSchemaSearchPath = (databaseUrl: string, appSchema: string | null): string => {
  if (!appSchema) {
    return databaseUrl;
  }

  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("options", `-csearch_path=${appSchema},public`);
  return parsed.toString();
};

export const getSharedRuntimeConfig = (): SharedRuntimeConfig => {
  const env = parseEnv();

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  };
};

export const getDbConfig = (): DbConfig => {
  const env = parseDbEnv();

  return {
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
  };
};

export const getMigrationDbConfig = (): DbConfig => {
  const migrationEnv = parseMigrationEnv();
  const appSchema = normalizeAppSchema(migrationEnv.APP_DB_SCHEMA);

  return {
    databaseUrl: withSchemaSearchPath(migrationEnv.DATABASE_URL, appSchema),
    appSchema,
  };
};

export const getStartupSeedConfig = (): StartupSeedConfig => {
  const env = parseStartupSeedEnv();

  return {
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    seedPack: env.APP_STARTUP_SEED_PACK,
  };
};

export const getBootstrapConfig = (): BootstrapConfig => {
  const env = parseBootstrapEnv();

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    graphileSchema: env.JOBS_GRAPHILE_SCHEMA,
    imageTag: env.APP_IMAGE_TAG.trim().length > 0 ? env.APP_IMAGE_TAG : null,
    seedPack: env.APP_STARTUP_SEED_PACK,
    telemetry: getTelemetryConfig(env),
  };
};

export const getGraphileSchema = (): string => {
  return parseGraphileSchemaEnv().JOBS_GRAPHILE_SCHEMA;
};

export const getApiConfig = (): ApiConfig => {
  const env = parseEnv();

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    port: env.API_PORT,
    frontendOrigin: env.FRONTEND_ORIGIN,
    deploymentEnvironment: env.APP_DEPLOYMENT_ENV,
    telemetry: getTelemetryConfig(env),
    auth: getAuthConfig(env),
    e2e: getE2eRuntimeConfig(env),
  };
};

export const getBlobStorageConfig = (): BlobStorageConfig => {
  const env = parseEnv();

  return {
    useAzurite: env.NODE_ENV !== "production",
    azuriteBlobEndpoint: "http://azurite:10000/devstoreaccount1",
    storageAccountName: env.AZURE_STORAGE_ACCOUNT_NAME,
    managedIdentityClientId: env.AZURE_CLIENT_ID,
    userUploadsContainerName: env.AZURE_USER_UPLOADS_CONTAINER_NAME,
  };
};

export const getJobsConfig = (): JobsConfig => {
  const env = parseJobsEnv();

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    port: env.JOBS_PORT,
    pollIntervalMs: env.JOBS_POLL_INTERVAL_MS,
    concurrency: env.JOBS_CONCURRENCY,
    graphileSchema: env.JOBS_GRAPHILE_SCHEMA,
    telemetry: getTelemetryConfig(env),
    e2e: getE2eRuntimeConfig(env),
  };
};

export const getJobQueueConfig = (): JobQueueConfig => {
  const env = parseJobQueueEnv();

  return {
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    pollIntervalMs: env.JOBS_POLL_INTERVAL_MS,
    concurrency: env.JOBS_CONCURRENCY,
    graphileSchema: env.JOBS_GRAPHILE_SCHEMA,
    schemaOverrideEnabled: env.APP_E2E_SCHEMA_OVERRIDE_ENABLED,
  };
};

export const getIdpConfig = (): IdpConfig => {
  const env = parseIdpEnv();

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    appSchema: normalizeAppSchema(env.APP_DB_SCHEMA),
    port: env.IDP_PORT,
    telemetry: getTelemetryConfig(env),
    oidc: getDevIdpConfig(env),
    e2e: getE2eRuntimeConfig(env),
  };
};
