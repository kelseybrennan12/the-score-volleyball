# Authentication and Session Architecture

## Spec Metadata

- ID: T0018
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define the authentication and session baseline for the starter repository.

## Goals

- Enforce authenticated access for all business API routes.
- Support an OIDC-compatible workforce identity provider without exposing provider tokens to browser JavaScript.
- Keep browser token exposure minimal by using backend-managed sessions.
- Preserve local-development auth parity through a mock OIDC flow.

## Non-Goals

- Defining the full long-term authorization policy model.
- Defining multi-tenant identity behavior.

## Core Concepts

- Backend-managed session: browser uses a secure session cookie while the backend performs OAuth/OIDC token exchange and
  refresh.
- Principal identity: authenticated actor keyed by stable provider claims.
- Local mock OIDC provider: dedicated local service that simulates discovery, authorize, token, and JWKS endpoints.
- Runtime mode split: local development runs separate frontend and API services for HMR.
- Runtime mode unified: production-style edge runtime serves SPA assets and reverse-proxies API/auth routes on one
  origin.

## Requirements

### Must:

- Production authentication uses backend-managed OIDC authorization-code exchange.
- Identity provider configuration is env-driven and OIDC-compatible. The default deployment examples use Entra ID, but
  the repository contract is provider-neutral.
- Frontend browser clients do not store API bearer tokens in JavaScript-accessible storage.
- Frontend and API business calls rely on authenticated backend session cookies.
- Unauthenticated visitors see an in-app login page with an explicit sign-in action.
- Frontend runtime detects authentication failures on in-session API/tRPC calls and redirects the browser to
  `/api/auth/login`.
- Local split-mode development supports cross-origin frontend-to-api calls with explicit credentialed CORS policy.
- Unified runtime mode serves frontend static assets and API/auth routes from one origin.
- Session cookies are `HttpOnly`, `Secure` in production, and use explicit `SameSite` policy.
- Backend enforces authentication for all business tRPC procedures and protected HTTP endpoints.
- Backend exposes unauthenticated `GET /healthz` for infrastructure probes.
- Backend maps authenticated principal identity through one centralized auth adapter.
- Backend persists or upserts user records on first-seen authenticated principals.
- New first-seen users default to starter-safe permissions.
- Production runtime ingress is publicly reachable and authentication is enforced at the application layer.
- Local development provides a mock OIDC provider service with discovery, authorize, token, and JWKS endpoints.
- Local development auth flows use the dedicated mock OIDC provider directly.
- Backend auth runtime configuration treats public issuer identity and server-side metadata fetch URL as separate
  concerns (`AUTH_ISSUER` and optional `AUTH_OIDC_METADATA_URL`).
- Backend runtime config for auth is centralized under
  [`/src/backend/runtime/adapters/infra/env.ts`](/src/backend/runtime/adapters/infra/env.ts).

### Should:

- Session rotation prevents fixation and supports sliding renewal for active sessions.
- Auth failure telemetry includes stable reason codes without logging token or secret material.
- Provider-specific secret and certificate management lives outside application code.

### May:

- Add policy-based authorization middleware abstractions as the starter grows.

## Open Questions

- Exact authorization policy model and administration UX remain deferred.

## Completion

- Status: Partial
- Remaining:
  - Define and implement the long-term authorization policy model.
