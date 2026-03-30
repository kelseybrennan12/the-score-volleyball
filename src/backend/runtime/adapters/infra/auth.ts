import { upsertAuthenticatedUser } from "backend/logic/services/auth-users";
import type { AuthConfig } from "backend/runtime/adapters/infra/env";
import { emitTelemetryLog } from "backend/runtime/adapters/infra/telemetry";
import type { AuthSessionRecord, UserRecord } from "backend/runtime/ports/read";
import type { RepoBundle } from "backend/runtime/ports/write";
import { createCipheriv, createDecipheriv, createHash, createPublicKey, createVerify, randomBytes } from "node:crypto";

const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const JWKS_TTL_MS = 5 * 60 * 1000;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export interface AuthPrincipalClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  tid: string;
  oid: string;
  exp: number;
  nbf?: number;
  iat?: number;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
  groups?: string[];
}

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

type Jwk = JsonWebKey &
  Record<string, unknown> & {
    kid?: string;
    alg?: string;
    use?: string;
  };

interface JwksDocument {
  keys: Jwk[];
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

interface SessionRecord {
  id: string;
  claims: AuthPrincipalClaims;
  refreshTokenCiphertext: string | null;
  refreshTokenIv: string | null;
  refreshTokenTag: string | null;
  accessTokenExpiresAtMs: number;
  maxExpiresAtMs: number;
  idleExpiresAtMs: number;
}

interface RefreshTokenStorage {
  refreshTokenCiphertext: string | null;
  refreshTokenIv: string | null;
  refreshTokenTag: string | null;
}

interface AuthRedirectTargets {
  redirectUri: string;
  postLoginRedirect: string;
  postLogoutRedirect: string;
}

export interface AuthRequestContext {
  requestOrigin?: string;
}

export interface AuthenticatedRequestContext {
  sessionId: string;
  claims: AuthPrincipalClaims;
  user: UserRecord;
}

export type AuthorizedSessionResult =
  | { ok: true; context: AuthenticatedRequestContext }
  | { ok: false; statusCode: 401 | 403; error: string };

export type SessionStatusResult =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      sessionId: string;
      claims: AuthPrincipalClaims;
      user: UserRecord;
    };

const nowMs = (): number => Date.now();

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const toBase64Url = (input: Buffer | string): string => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const fromBase64Url = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const parseJson = <T>(input: Buffer): T => {
  return JSON.parse(input.toString("utf8")) as T;
};

const randomToken = (size: number = 32): string => toBase64Url(randomBytes(size));

const parseCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());

  for (const segment of segments) {
    if (!segment) {
      continue;
    }

    const [rawName, ...rest] = segment.split("=");

    if (rawName !== name) {
      continue;
    }

    return rest.join("=") || null;
  }

  return null;
};

const buildCookie = (name: string, value: string, maxAgeSeconds: number, secure: boolean): string => {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const hashOpaqueValue = (value: string): string => {
  return toBase64Url(createHash("sha256").update(value, "utf8").digest());
};

const claimAsString = (claims: Record<string, unknown>, key: string): string | undefined => {
  const value = claims[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const claimAsNumber = (claims: Record<string, unknown>, key: string): number | undefined => {
  const value = claims[key];
  return typeof value === "number" ? value : undefined;
};

const matchesAudience = (tokenAudience: string | string[], expectedAudience: string): boolean => {
  if (Array.isArray(tokenAudience)) {
    return tokenAudience.includes(expectedAudience);
  }

  return tokenAudience === expectedAudience;
};

const parseSessionEncryptionKey = (rawKey: string): Buffer => {
  const decoded = Buffer.from(rawKey, "base64");

  if (decoded.length !== 32) {
    throw new Error("invalid_session_encryption_key");
  }

  return decoded;
};

const claimsToJson = (claims: AuthPrincipalClaims): Record<string, unknown> => {
  return { ...claims };
};

const toSessionRecord = (record: AuthSessionRecord): SessionRecord => {
  const claims = record.claimsJson;
  const audienceRaw = claims.aud;
  const audience = Array.isArray(audienceRaw)
    ? audienceRaw.filter((value): value is string => typeof value === "string")
    : typeof audienceRaw === "string"
      ? audienceRaw
      : "";
  const iss = claimAsString(claims, "iss") ?? "";
  const tid = claimAsString(claims, "tid") ?? "";
  const oid = claimAsString(claims, "oid") ?? "";
  const sub = claimAsString(claims, "sub") ?? "";
  const exp = claimAsNumber(claims, "exp") ?? 0;
  const groups = Array.isArray(claims.groups)
    ? claims.groups.filter((value): value is string => typeof value === "string")
    : undefined;

  const missingAudience =
    (Array.isArray(audience) && audience.length === 0) || (typeof audience === "string" && !audience);

  if (!iss || !tid || !oid || !sub || exp <= 0 || missingAudience) {
    throw new Error("invalid_session_claims");
  }

  return {
    id: record.id,
    claims: {
      iss,
      aud: audience,
      sub,
      tid,
      oid,
      exp,
      nbf: claimAsNumber(claims, "nbf"),
      iat: claimAsNumber(claims, "iat"),
      email: claimAsString(claims, "email"),
      preferred_username: claimAsString(claims, "preferred_username"),
      upn: claimAsString(claims, "upn"),
      name: claimAsString(claims, "name"),
      groups,
    },
    refreshTokenCiphertext: record.refreshTokenCiphertext,
    refreshTokenIv: record.refreshTokenIv,
    refreshTokenTag: record.refreshTokenTag,
    accessTokenExpiresAtMs: record.accessTokenExpiresAt.getTime(),
    maxExpiresAtMs: record.maxExpiresAt.getTime(),
    idleExpiresAtMs: record.idleExpiresAt.getTime(),
  };
};

export class AuthManager {
  private discoveryCache: { value: OidcDiscoveryDocument; fetchedAtMs: number } | null = null;
  private jwksCache: { value: JwksDocument; fetchedAtMs: number } | null = null;
  private readonly sessionEncryptionKey: Buffer;

  constructor(private readonly config: AuthConfig) {
    this.sessionEncryptionKey = parseSessionEncryptionKey(config.sessionEncryptionKey);
  }

  public buildSessionCookie(sessionId: string): string {
    const maxAgeSeconds = Math.floor(this.config.sessionIdleTimeoutMs / 1000);
    return buildCookie(this.config.sessionCookieName, sessionId, maxAgeSeconds, this.config.cookieSecure);
  }

  public buildClearSessionCookie(): string {
    return buildCookie(this.config.sessionCookieName, "", 0, this.config.cookieSecure);
  }

  public async getLoginRedirectUrl(repos: RepoBundle, context?: AuthRequestContext): Promise<string> {
    const state = randomToken(18);
    const stateHash = hashOpaqueValue(state);
    const expiresAt = new Date(nowMs() + this.config.stateTtlMs);
    const redirectTargets = this.resolveRedirectTargets(context);

    await repos.withTransaction(async ({ writeRepo }) => {
      await writeRepo.createAuthLoginState({
        stateHash,
        expiresAt,
        redirectUri: redirectTargets.redirectUri,
        postLoginRedirect: redirectTargets.postLoginRedirect,
        postLogoutRedirect: redirectTargets.postLogoutRedirect,
      });
      await writeRepo.pruneAuthLoginStates();
    });

    const discovery = await this.getDiscoveryDocument();
    const authorizationEndpoint =
      this.config.provider === "dev"
        ? `${this.resolveDevBrowserIssuer(context)}/authorize`
        : discovery.authorization_endpoint;
    const authUrl = new URL(authorizationEndpoint);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", redirectTargets.redirectUri);
    authUrl.searchParams.set("scope", this.config.scope);
    authUrl.searchParams.set("state", state);

    return authUrl.toString();
  }

  public async completeLoginWithCode(
    input: { code: string; state: string },
    repos: RepoBundle,
    context?: AuthRequestContext,
  ): Promise<{ sessionId: string; postLoginRedirect: string }> {
    const stateHash = hashOpaqueValue(input.state);
    const consumed = await repos.withTransaction(async ({ writeRepo }) => {
      return writeRepo.consumeAuthLoginState(stateHash);
    });

    if (!consumed) {
      throw new Error("invalid_or_expired_login_state");
    }

    const redirectTargets = this.resolveRedirectTargets(context, {
      redirectUri: consumed.redirectUri ?? undefined,
      postLoginRedirect: consumed.postLoginRedirect ?? undefined,
      postLogoutRedirect: consumed.postLogoutRedirect ?? undefined,
    });

    const tokens = await this.exchangeCodeForTokens(input.code, redirectTargets.redirectUri);
    const claims = await this.validateToken(tokens.id_token ?? tokens.access_token);

    const groups = Array.isArray(claims.groups) ? claims.groups : [];

    const isAdmin = this.config.adminGroupId !== "" && groups.includes(this.config.adminGroupId);

    const isUser = !isAdmin && this.config.userGroupId !== "" && groups.includes(this.config.userGroupId);

    const role = isAdmin ? "admin" : isUser ? "user" : "unverified";

    console.log(`UPSERTING USER EMAIL: ${claims.email}`);
    console.log(`CONFIGURED ADMIN GROUP ID: ${this.config.adminGroupId}`);
    console.log(`CONFIGURED USER GROUP ID: ${this.config.userGroupId}`);
    console.log(`GROUPS: ${groups}`);
    console.log(`isAdmin: ${isAdmin}, isUser: ${isUser}, role: ${role}`);

    const user = await upsertAuthenticatedUser(repos, {
      tenantId: claims.tid,
      aadObjectId: claims.oid,
      email: claims.preferred_username ?? claims.email ?? claims.upn ?? null,
      displayName: claims.name ?? null,
      role,
      isAuthorized: isAdmin || isUser,
    });

    const issuedAtMs = nowMs();
    const sessionId = randomToken(32);
    const refreshStorage = this.encryptRefreshToken(tokens.refresh_token ?? null);

    await repos.withTransaction(async ({ writeRepo }) => {
      await writeRepo.createAuthSession({
        id: randomToken(18),
        sessionHash: hashOpaqueValue(sessionId),
        tenantId: claims.tid,
        aadObjectId: claims.oid,
        userId: user.id,
        claimsJson: claimsToJson(claims),
        refreshTokenCiphertext: refreshStorage.refreshTokenCiphertext,
        refreshTokenIv: refreshStorage.refreshTokenIv,
        refreshTokenTag: refreshStorage.refreshTokenTag,
        accessTokenExpiresAt: new Date(issuedAtMs + tokens.expires_in * 1000),
        idleExpiresAt: new Date(issuedAtMs + this.config.sessionIdleTimeoutMs),
        maxExpiresAt: new Date(issuedAtMs + this.config.sessionMaxLifetimeMs),
      });
      await writeRepo.pruneExpiredAuthSessions();
    });

    return {
      sessionId,
      postLoginRedirect: redirectTargets.postLoginRedirect,
    };
  }

  public async clearSession(cookieHeader: string | undefined, repos: RepoBundle): Promise<void> {
    const sessionId = parseCookie(cookieHeader, this.config.sessionCookieName);

    if (!sessionId) {
      return;
    }

    await repos.withTransaction(async ({ writeRepo }) => {
      await writeRepo.revokeAuthSessionByHash(hashOpaqueValue(sessionId));
    });
  }

  public async getSessionStatus(cookieHeader: string | undefined, repos: RepoBundle): Promise<SessionStatusResult> {
    const session = await this.resolveSession(cookieHeader, repos);

    if (!session) {
      return { authenticated: false };
    }

    const groups = Array.isArray(session.claims.groups) ? session.claims.groups : [];
    const isAdmin = this.config.adminGroupId !== "" && groups.includes(this.config.adminGroupId);
    const isUser = !isAdmin && this.config.userGroupId !== "" && groups.includes(this.config.userGroupId);
    const role = isAdmin ? "admin" : isUser ? "user" : "unverified";

    const user = await upsertAuthenticatedUser(repos, {
      tenantId: session.claims.tid,
      aadObjectId: session.claims.oid,
      email: session.claims.preferred_username ?? session.claims.email ?? session.claims.upn ?? null,
      displayName: session.claims.name ?? null,
      role,
      isAuthorized: isAdmin || isUser,
    });

    return {
      authenticated: true,
      sessionId: session.id,
      claims: session.claims,
      user,
    };
  }

  public async requireAuthorizedSession(
    cookieHeader: string | undefined,
    repos: RepoBundle,
  ): Promise<AuthorizedSessionResult> {
    const sessionStatus = await this.getSessionStatus(cookieHeader, repos);

    if (!sessionStatus.authenticated) {
      return {
        ok: false,
        statusCode: 401,
        error: "unauthenticated",
      };
    }

    if (!sessionStatus.user.isActive || !sessionStatus.user.isAuthorized) {
      return {
        ok: false,
        statusCode: 403,
        error: "forbidden",
      };
    }

    return {
      ok: true,
      context: {
        sessionId: sessionStatus.sessionId,
        claims: sessionStatus.claims,
        user: sessionStatus.user,
      },
    };
  }

  public async getLogoutRedirectUrl(context?: AuthRequestContext): Promise<string> {
    const redirectTargets = this.resolveRedirectTargets(context);

    if (this.config.provider === "dev") {
      const logoutUrl = new URL(`${this.resolveDevBrowserIssuer(context)}/endsession`);
      logoutUrl.searchParams.set("client_id", this.config.clientId);
      logoutUrl.searchParams.set("post_logout_redirect_uri", redirectTargets.postLogoutRedirect);
      return logoutUrl.toString();
    }

    const discovery = await this.getDiscoveryDocument();

    if (!discovery.end_session_endpoint) {
      return redirectTargets.postLogoutRedirect;
    }

    const logoutUrl = new URL(discovery.end_session_endpoint);
    logoutUrl.searchParams.set("client_id", this.config.clientId);
    logoutUrl.searchParams.set("post_logout_redirect_uri", redirectTargets.postLogoutRedirect);
    return logoutUrl.toString();
  }

  public getPostLoginRedirectUrl(context?: AuthRequestContext): string {
    return this.resolveRedirectTargets(context).postLoginRedirect;
  }

  public getLoginErrorRedirectUrl(reason: string, context?: AuthRequestContext): string {
    const url = new URL(this.resolveRedirectTargets(context).postLoginRedirect);
    url.pathname = "/";
    url.searchParams.set("auth_error", reason);
    return url.toString();
  }

  private resolveRedirectTargets(
    context?: AuthRequestContext,
    loginStateOverride?: Partial<AuthRedirectTargets>,
  ): AuthRedirectTargets {
    const requestOrigin = this.normalizeOrigin(context?.requestOrigin);
    const baseOrigin =
      requestOrigin ?? this.normalizeOrigin(this.config.defaultAppOrigin) ?? this.config.defaultAppOrigin;
    const useStaticOverrides = this.config.provider !== "dev";

    const redirectUri =
      loginStateOverride?.redirectUri ??
      (useStaticOverrides ? this.config.redirectUri : null) ??
      new URL("/api/auth/callback", baseOrigin).toString();

    const postLoginRedirect =
      loginStateOverride?.postLoginRedirect ??
      (useStaticOverrides ? this.config.postLoginRedirect : null) ??
      new URL("/dashboard", baseOrigin).toString();

    const postLogoutRedirect =
      loginStateOverride?.postLogoutRedirect ??
      (useStaticOverrides ? this.config.postLogoutRedirect : null) ??
      new URL("/", baseOrigin).toString();

    return {
      redirectUri,
      postLoginRedirect,
      postLogoutRedirect,
    };
  }

  private normalizeOrigin(value: string | undefined | null): string | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = new URL(value);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return null;
    }
  }

  private resolveDevBrowserIssuer(context?: AuthRequestContext): string {
    const requestOrigin = this.normalizeOrigin(context?.requestOrigin);
    const loopbackIssuer = stripTrailingSlash(this.config.issuer);
    const nonLoopbackIssuerOverride = this.config.devBrowserIssuerNonLoopback
      ? stripTrailingSlash(this.config.devBrowserIssuerNonLoopback)
      : null;

    if (requestOrigin) {
      const requestHost = new URL(requestOrigin).hostname;
      if (loopbackHosts.has(requestHost)) {
        return loopbackIssuer;
      }

      return nonLoopbackIssuerOverride ?? loopbackIssuer;
    }

    return loopbackIssuer;
  }

  private async resolveSession(cookieHeader: string | undefined, repos: RepoBundle): Promise<SessionRecord | null> {
    const sessionId = parseCookie(cookieHeader, this.config.sessionCookieName);

    if (!sessionId) {
      return null;
    }

    const sessionHash = hashOpaqueValue(sessionId);
    const existing = await repos.readRepo.getAuthSessionByHash(sessionHash);

    if (!existing || existing.revokedAt) {
      return null;
    }

    let current: SessionRecord;

    try {
      current = toSessionRecord(existing);
    } catch {
      await repos.withTransaction(async ({ writeRepo }) => {
        await writeRepo.revokeAuthSessionByHash(sessionHash);
      });
      return null;
    }

    if (current.maxExpiresAtMs <= nowMs() || current.idleExpiresAtMs <= nowMs()) {
      await repos.withTransaction(async ({ writeRepo }) => {
        await writeRepo.revokeAuthSessionByHash(sessionHash);
        await writeRepo.pruneExpiredAuthSessions();
      });
      return null;
    }

    let shouldUpdate = false;
    let nextClaims = current.claims;
    let nextAccessExpiry = current.accessTokenExpiresAtMs;
    let nextRefreshStorage: RefreshTokenStorage = {
      refreshTokenCiphertext: current.refreshTokenCiphertext,
      refreshTokenIv: current.refreshTokenIv,
      refreshTokenTag: current.refreshTokenTag,
    };

    if (current.accessTokenExpiresAtMs <= nowMs()) {
      const decryptedRefreshToken = this.decryptRefreshToken(current);

      if (!decryptedRefreshToken) {
        await repos.withTransaction(async ({ writeRepo }) => {
          await writeRepo.revokeAuthSessionByHash(sessionHash);
        });
        return null;
      }

      try {
        const refreshed = await this.exchangeRefreshToken(decryptedRefreshToken);
        nextClaims = await this.validateToken(refreshed.id_token ?? refreshed.access_token);
        nextAccessExpiry = nowMs() + refreshed.expires_in * 1000;
        nextRefreshStorage = this.encryptRefreshToken(refreshed.refresh_token ?? decryptedRefreshToken);
        shouldUpdate = true;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown_error";
        emitTelemetryLog("warn", "auth.refresh_failed", {
          event: "auth.refresh_failed",
          reason,
        });
        await repos.withTransaction(async ({ writeRepo }) => {
          await writeRepo.revokeAuthSessionByHash(sessionHash);
        });
        return null;
      }
    }

    const nextIdleExpiresAtMs = Math.min(nowMs() + this.config.sessionIdleTimeoutMs, current.maxExpiresAtMs);

    if (nextIdleExpiresAtMs > current.idleExpiresAtMs) {
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      const updated = await repos.withTransaction(async ({ writeRepo }) => {
        return writeRepo.updateAuthSession({
          id: current.id,
          claimsJson: claimsToJson(nextClaims),
          refreshTokenCiphertext: nextRefreshStorage.refreshTokenCiphertext,
          refreshTokenIv: nextRefreshStorage.refreshTokenIv,
          refreshTokenTag: nextRefreshStorage.refreshTokenTag,
          accessTokenExpiresAt: new Date(nextAccessExpiry),
          idleExpiresAt: new Date(nextIdleExpiresAtMs),
        });
      });

      if (!updated) {
        return null;
      }
    }

    return {
      id: current.id,
      claims: nextClaims,
      refreshTokenCiphertext: nextRefreshStorage.refreshTokenCiphertext,
      refreshTokenIv: nextRefreshStorage.refreshTokenIv,
      refreshTokenTag: nextRefreshStorage.refreshTokenTag,
      accessTokenExpiresAtMs: nextAccessExpiry,
      maxExpiresAtMs: current.maxExpiresAtMs,
      idleExpiresAtMs: nextIdleExpiresAtMs,
    };
  }

  private encryptRefreshToken(refreshToken: string | null): RefreshTokenStorage {
    if (!refreshToken) {
      return {
        refreshTokenCiphertext: null,
        refreshTokenIv: null,
        refreshTokenTag: null,
      };
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.sessionEncryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      refreshTokenCiphertext: toBase64Url(ciphertext),
      refreshTokenIv: toBase64Url(iv),
      refreshTokenTag: toBase64Url(tag),
    };
  }

  private decryptRefreshToken(record: SessionRecord): string | null {
    if (!record.refreshTokenCiphertext || !record.refreshTokenIv || !record.refreshTokenTag) {
      return null;
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", this.sessionEncryptionKey, fromBase64Url(record.refreshTokenIv));
      decipher.setAuthTag(fromBase64Url(record.refreshTokenTag));
      const plaintext = Buffer.concat([
        decipher.update(fromBase64Url(record.refreshTokenCiphertext)),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch {
      return null;
    }
  }

  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    const discovery = await this.getDiscoveryDocument();
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: this.config.clientId,
        ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("token_exchange_failed");
    }

    const payload = (await response.json()) as Partial<TokenResponse>;

    if (!payload.access_token || !payload.token_type) {
      throw new Error("token_exchange_invalid_response");
    }

    return {
      access_token: payload.access_token,
      token_type: payload.token_type,
      expires_in: payload.expires_in ?? 300,
      refresh_token: payload.refresh_token,
      id_token: typeof payload.id_token === "string" ? payload.id_token : undefined,
    };
  }

  private async exchangeRefreshToken(refreshToken: string): Promise<TokenResponse> {
    const discovery = await this.getDiscoveryDocument();
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("refresh_token_exchange_failed");
    }

    const payload = (await response.json()) as Partial<TokenResponse>;

    if (!payload.access_token || !payload.token_type) {
      throw new Error("refresh_token_exchange_invalid_response");
    }

    return {
      access_token: payload.access_token,
      token_type: payload.token_type,
      expires_in: payload.expires_in ?? 300,
      refresh_token: payload.refresh_token,
      id_token: typeof payload.id_token === "string" ? payload.id_token : undefined,
    };
  }

  private async validateToken(token: string): Promise<AuthPrincipalClaims> {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error("invalid_token_format");
    }

    const header = parseJson<Record<string, unknown>>(fromBase64Url(encodedHeader));
    const payload = parseJson<Record<string, unknown>>(fromBase64Url(encodedPayload));

    if (header.alg !== "RS256") {
      throw new Error("unsupported_token_algorithm");
    }

    const kid = typeof header.kid === "string" ? header.kid : undefined;

    if (!kid) {
      throw new Error("missing_token_kid");
    }

    const jwk = await this.getJwkByKid(kid);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const signatureValid = verifier.verify(publicKey, fromBase64Url(encodedSignature));

    if (!signatureValid) {
      throw new Error("invalid_token_signature");
    }

    const exp = claimAsNumber(payload, "exp");
    const nbf = claimAsNumber(payload, "nbf");
    const iat = claimAsNumber(payload, "iat");
    const audRaw = payload.aud;
    const iss = claimAsString(payload, "iss");
    const tid = claimAsString(payload, "tid");
    const oid = claimAsString(payload, "oid");
    const sub = claimAsString(payload, "sub") ?? oid;

    if (!exp || !iss || !tid || !oid || !sub) {
      throw new Error("missing_required_token_claims");
    }

    const now = Math.floor(nowMs() / 1000);

    if (exp <= now) {
      throw new Error("expired_token");
    }

    if (nbf && nbf > now) {
      throw new Error("token_not_active");
    }

    const audience = Array.isArray(audRaw)
      ? audRaw.filter((value): value is string => typeof value === "string")
      : typeof audRaw === "string"
        ? audRaw
        : "";

    if (!matchesAudience(audience, this.config.audience)) {
      throw new Error("invalid_token_audience");
    }

    if (iss !== stripTrailingSlash(this.config.issuer)) {
      throw new Error("invalid_token_issuer");
    }

    if (tid !== this.config.tenantId) {
      throw new Error("invalid_token_tenant");
    }

    return {
      iss,
      aud: audience,
      sub,
      tid,
      oid,
      exp,
      nbf,
      iat,
      email: claimAsString(payload, "email"),
      preferred_username: claimAsString(payload, "preferred_username"),
      upn: claimAsString(payload, "upn"),
      name: claimAsString(payload, "name"),
      groups: Array.isArray(payload.groups)
        ? (payload.groups as unknown[]).filter((v): v is string => typeof v === "string")
        : undefined,
    };
  }

  private async getDiscoveryDocument(): Promise<OidcDiscoveryDocument> {
    if (this.discoveryCache && nowMs() - this.discoveryCache.fetchedAtMs < DISCOVERY_TTL_MS) {
      return this.discoveryCache.value;
    }

    const discovery = await this.fetchDiscoveryDocument(this.config.oidcMetadataUrl);
    this.discoveryCache = { value: discovery, fetchedAtMs: nowMs() };
    return discovery;
  }

  private async fetchDiscoveryDocument(discoveryUrl: string): Promise<OidcDiscoveryDocument> {
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      throw new Error("oidc_discovery_failed");
    }

    const payload = (await response.json()) as Partial<OidcDiscoveryDocument>;

    if (!payload.issuer || !payload.authorization_endpoint || !payload.token_endpoint || !payload.jwks_uri) {
      throw new Error("oidc_discovery_invalid");
    }

    return {
      issuer: payload.issuer,
      authorization_endpoint: payload.authorization_endpoint,
      token_endpoint: payload.token_endpoint,
      jwks_uri: payload.jwks_uri,
      end_session_endpoint: typeof payload.end_session_endpoint === "string" ? payload.end_session_endpoint : undefined,
    };
  }

  private async getJwkByKid(kid: string): Promise<Jwk> {
    const jwks = await this.getJwksDocument();
    const key = jwks.keys.find((candidate) => candidate.kid === kid);

    if (!key) {
      this.jwksCache = null;
      const refreshedJwks = await this.getJwksDocument();
      const refreshedKey = refreshedJwks.keys.find((candidate) => candidate.kid === kid);

      if (!refreshedKey) {
        throw new Error("jwks_key_not_found");
      }

      return refreshedKey;
    }

    return key;
  }

  private async getJwksDocument(): Promise<JwksDocument> {
    if (this.jwksCache && nowMs() - this.jwksCache.fetchedAtMs < JWKS_TTL_MS) {
      return this.jwksCache.value;
    }

    const discovery = await this.getDiscoveryDocument();
    const response = await fetch(discovery.jwks_uri);

    if (!response.ok) {
      throw new Error("jwks_fetch_failed");
    }

    const payload = (await response.json()) as Partial<JwksDocument>;

    if (!payload.keys || !Array.isArray(payload.keys)) {
      throw new Error("jwks_invalid");
    }

    const jwks: JwksDocument = {
      keys: payload.keys,
    };

    this.jwksCache = {
      value: jwks,
      fetchedAtMs: nowMs(),
    };

    return jwks;
  }
}

export const createAuthManager = (config: AuthConfig): AuthManager => {
  return new AuthManager(config);
};
