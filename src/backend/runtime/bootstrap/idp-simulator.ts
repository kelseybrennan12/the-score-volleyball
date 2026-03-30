import { getUserForDevLogin, listUsersForDevLogin } from "backend/logic/services/auth-users";
import type { DevIdpConfig } from "backend/runtime/adapters/infra/env";
import type { RepoBundle } from "backend/runtime/ports/write";
import { createSign, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint: string;
}

type Jwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

interface JwksDocument {
  keys: Jwk[];
}

interface DevCodeRecord {
  code: string;
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  principal: {
    tenantId: string;
    aadObjectId: string;
    email: string | null;
    displayName: string | null;
    groups?: string[];
  };
  expiresAtMs: number;
}

interface DevRefreshRecord {
  refreshToken: string;
  issuer: string;
  principal: {
    tenantId: string;
    aadObjectId: string;
    email: string | null;
    displayName: string | null;
    groups?: string[];
  };
  clientId: string;
  scope: string;
}

const nowMs = (): number => Date.now();

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const toBase64Url = (input: Buffer | string): string => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const randomToken = (size: number = 32): string => toBase64Url(randomBytes(size));

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export class LocalOidcSimulator {
  private readonly codes = new Map<string, DevCodeRecord>();
  private readonly refreshTokens = new Map<string, DevRefreshRecord>();
  private readonly privateKey: KeyObject;
  private readonly publicJwk: Jwk;
  private readonly kid: string;

  constructor(private readonly config: DevIdpConfig) {
    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    this.privateKey = keyPair.privateKey;
    this.kid = randomToken(12);
    this.publicJwk = {
      ...(keyPair.publicKey.export({ format: "jwk" }) as Jwk),
      alg: "RS256",
      use: "sig",
      kid: this.kid,
    };
  }

  public getDiscoveryDocument(issuerValue: string): OidcDiscoveryDocument {
    const issuer = stripTrailingSlash(issuerValue);

    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      end_session_endpoint: `${issuer}/endsession`,
    };
  }

  public getDiscoveryDocumentWithEndpointBase(issuerValue: string, endpointBaseValue: string): OidcDiscoveryDocument {
    const issuer = stripTrailingSlash(issuerValue);
    const endpointBase = stripTrailingSlash(endpointBaseValue);

    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${endpointBase}/token`,
      jwks_uri: `${endpointBase}/jwks`,
      end_session_endpoint: `${issuer}/endsession`,
    };
  }

  public getJwksDocument(): JwksDocument {
    return {
      keys: [this.publicJwk],
    };
  }

  public async renderLoginPage(repos: RepoBundle, query: Record<string, string>, issuerValue: string): Promise<string> {
    const users = await listUsersForDevLogin(repos);
    const authorizePath = `${stripTrailingSlash(issuerValue)}/authorize`;

    const hiddenFields = Object.entries(query)
      .filter(([key]) => key !== "user_id")
      .map(([key, value]) => `<input type="hidden" name="${htmlEscape(key)}" value="${htmlEscape(value)}" />`)
      .join("\n");

    const userRows = users
      .map((user) => {
        const label = user.displayName ?? user.email ?? user.id;
        const access = user.isAuthorized ? "authorized" : "no access";
        const status = `${user.role} / ${access}`;

        return `
          <li>
            <form method="get" action="${htmlEscape(authorizePath)}">
              ${hiddenFields}
              <input type="hidden" name="user_id" value="${htmlEscape(user.id)}" />
              <button type="submit">${htmlEscape(label)} (${status})</button>
            </form>
          </li>
        `;
      })
      .join("\n");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Local Login</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; }
      h1 { margin-bottom: 0.5rem; }
      ul { padding-left: 1.2rem; }
      li { margin-bottom: 0.75rem; }
      button { padding: 0.35rem 0.6rem; cursor: pointer; }
      .new-user { margin-top: 1.25rem; }
    </style>
  </head>
  <body>
    <h1>Local OIDC Login</h1>
    <p>Pick a seeded user or create a new synthetic user.</p>
    <ul>
      ${userRows}
    </ul>
    <form class="new-user" method="get" action="${htmlEscape(authorizePath)}">
      ${hiddenFields}
      <input type="hidden" name="user_id" value="new" />
      <button type="submit">New User</button>
    </form>
    <form class="new-user" method="get" action="${htmlEscape(authorizePath)}">
      ${hiddenFields}
      <input type="hidden" name="user_id" value="new-admin-group" />
      <button type="submit">New User (admin group)</button>
    </form>
    <form class="new-user" method="get" action="${htmlEscape(authorizePath)}">
      ${hiddenFields}
      <input type="hidden" name="user_id" value="new-user-group" />
      <button type="submit">New User (user group)</button>
    </form>
  </body>
</html>`;
  }

  public async authorizeUser(
    repos: RepoBundle,
    query: {
      response_type: string;
      client_id: string;
      redirect_uri: string;
      scope?: string;
      state?: string;
      user_id?: string;
    },
    issuerValue: string,
  ): Promise<{ type: "redirect"; location: string } | { type: "error"; statusCode: number; error: string }> {
    const endpointIssuer = stripTrailingSlash(issuerValue);
    const tokenIssuer = stripTrailingSlash(this.config.issuer);

    if (query.response_type !== "code") {
      return { type: "error", statusCode: 400, error: "unsupported_response_type" };
    }

    if (query.client_id !== this.config.clientId) {
      return { type: "error", statusCode: 400, error: "invalid_client" };
    }

    if (!query.user_id) {
      const loginUrl = new URL(`${endpointIssuer}/login`);

      loginUrl.searchParams.set("response_type", query.response_type);
      loginUrl.searchParams.set("client_id", query.client_id);
      loginUrl.searchParams.set("redirect_uri", query.redirect_uri);
      loginUrl.searchParams.set("scope", query.scope ?? this.config.scope);

      if (query.state) {
        loginUrl.searchParams.set("state", query.state);
      }

      return {
        type: "redirect",
        location: loginUrl.toString(),
      };
    }

    let principal: DevCodeRecord["principal"];

    if (query.user_id === "new" || query.user_id === "new-admin-group" || query.user_id === "new-user-group") {
      const groups =
        query.user_id === "new-admin-group"
          ? [this.config.adminGroupId]
          : query.user_id === "new-user-group"
            ? [this.config.userGroupId]
            : undefined;
      principal = {
        tenantId: this.config.tenantId,
        aadObjectId: `new-${randomToken(8)}`,
        email: `new-${randomToken(4).toLowerCase()}@starter.local`,
        displayName: "New Local User",
        groups,
      };
    } else {
      const user = await getUserForDevLogin(repos, query.user_id);

      if (!user) {
        return { type: "error", statusCode: 400, error: "unknown_user" };
      }

      const groups =
        user.role === "admin"
          ? [this.config.adminGroupId]
          : user.role === "user"
            ? [this.config.userGroupId]
            : undefined;

      principal = {
        tenantId: user.tenantId,
        aadObjectId: user.aadObjectId,
        email: user.email,
        displayName: user.displayName,
        groups,
      };
    }

    const code = randomToken(24);
    this.codes.set(code, {
      code,
      issuer: tokenIssuer,
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      scope: query.scope ?? this.config.scope,
      principal,
      expiresAtMs: nowMs() + 60_000,
    });

    const redirectUrl = new URL(query.redirect_uri);
    redirectUrl.searchParams.set("code", code);

    if (query.state) {
      redirectUrl.searchParams.set("state", query.state);
    }

    return {
      type: "redirect",
      location: redirectUrl.toString(),
    };
  }

  public async exchangeToken(formBody: {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    client_id?: string;
    client_secret?: string;
    refresh_token?: string;
    scope?: string;
  }): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    if (this.config.clientSecret && formBody.client_secret !== this.config.clientSecret) {
      return {
        statusCode: 401,
        body: {
          error: "invalid_client",
        },
      };
    }

    if (formBody.grant_type === "authorization_code") {
      const code = formBody.code;

      if (!code) {
        return {
          statusCode: 400,
          body: {
            error: "invalid_request",
          },
        };
      }

      const record = this.codes.get(code);

      if (!record || record.expiresAtMs < nowMs()) {
        this.codes.delete(code);
        return {
          statusCode: 400,
          body: {
            error: "invalid_grant",
          },
        };
      }

      this.codes.delete(code);

      if (formBody.client_id !== record.clientId || formBody.redirect_uri !== record.redirectUri) {
        return {
          statusCode: 400,
          body: {
            error: "invalid_grant",
          },
        };
      }

      const refreshToken = randomToken(28);
      this.refreshTokens.set(refreshToken, {
        refreshToken,
        issuer: record.issuer,
        principal: record.principal,
        clientId: record.clientId,
        scope: record.scope,
      });

      return {
        statusCode: 200,
        body: this.issueTokens(record.issuer, record.principal, record.scope, refreshToken),
      };
    }

    if (formBody.grant_type === "refresh_token") {
      const refreshToken = formBody.refresh_token;

      if (!refreshToken) {
        return {
          statusCode: 400,
          body: {
            error: "invalid_request",
          },
        };
      }

      const refreshRecord = this.refreshTokens.get(refreshToken);

      if (!refreshRecord || (formBody.client_id && formBody.client_id !== refreshRecord.clientId)) {
        return {
          statusCode: 400,
          body: {
            error: "invalid_grant",
          },
        };
      }

      return {
        statusCode: 200,
        body: this.issueTokens(refreshRecord.issuer, refreshRecord.principal, refreshRecord.scope, refreshToken),
      };
    }

    return {
      statusCode: 400,
      body: {
        error: "unsupported_grant_type",
      },
    };
  }

  private issueTokens(
    issuer: string,
    principal: DevCodeRecord["principal"],
    scope: string,
    refreshToken: string,
  ): Record<string, unknown> {
    const expiresIn = 300;
    const issuedAt = Math.floor(nowMs() / 1000);
    const expiresAt = issuedAt + expiresIn;

    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: this.kid,
    };

    const payload = {
      iss: issuer,
      aud: this.config.audience,
      sub: principal.aadObjectId,
      tid: principal.tenantId,
      oid: principal.aadObjectId,
      email: principal.email ?? undefined,
      preferred_username: principal.email ?? undefined,
      name: principal.displayName ?? undefined,
      groups: principal.groups ?? undefined,
      iat: issuedAt,
      nbf: issuedAt,
      exp: expiresAt,
      scope,
    };

    return {
      access_token: this.signJwt(header, payload),
      id_token: this.signJwt(header, payload),
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
    };
  }

  private signJwt(header: Record<string, unknown>, payload: Record<string, unknown>): string {
    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign("RSA-SHA256");
    signer.update(data);
    signer.end();

    const signature = signer.sign(this.privateKey);
    return `${data}.${toBase64Url(signature)}`;
  }
}
