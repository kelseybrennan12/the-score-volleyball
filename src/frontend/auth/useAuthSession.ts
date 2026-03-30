import { resolveApiUrl } from "@frontend/api/urls";
import { isAuthFailureStatus, redirectToLogin } from "@frontend/auth/redirect";
import type { UserRole } from "backend/runtime/adapters/infra/db/schema";
import { useEffect, useState } from "react";

export type DeploymentEnvironment = "local" | "staging" | "prod";

interface SessionUser {
  id: string;
  tenantId: string;
  aadObjectId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isAuthorized: boolean;
  isActive: boolean;
}

interface AuthenticatedSessionResponse {
  authenticated: true;
  deploymentEnvironment: DeploymentEnvironment;
  user: SessionUser;
}

interface UnauthenticatedSessionResponse {
  authenticated: false;
  deploymentEnvironment: DeploymentEnvironment;
}

type AuthSessionResponse = AuthenticatedSessionResponse | UnauthenticatedSessionResponse;

export interface AuthSessionState {
  loading: boolean;
  authenticated: boolean;
  user: SessionUser | null;
  error: string | null;
  deploymentEnvironment: DeploymentEnvironment | null;
}

export const authSessionHeartbeatIntervalMs = 60_000;

export const useAuthSession = (): AuthSessionState => {
  const [state, setState] = useState<AuthSessionState>({
    loading: true,
    authenticated: false,
    user: null,
    error: null,
    deploymentEnvironment: null,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authErrorMessage = authError ? `Login failed: ${authError}` : null;

    if (authError) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("auth_error");
      window.history.replaceState({}, "", cleanUrl.toString());
    }

    let cancelled = false;

    fetch(resolveApiUrl("/auth/session"), {
      credentials: "include",
    })
      .then(async (res) => {
        if (isAuthFailureStatus(res.status)) {
          return (await res.json()) as UnauthenticatedSessionResponse;
        }

        if (!res.ok) {
          throw new Error(`Auth session check failed: ${res.status}`);
        }

        return (await res.json()) as AuthSessionResponse;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (!data) {
          setState({
            loading: false,
            authenticated: false,
            user: null,
            error: authErrorMessage,
            deploymentEnvironment: null,
          });
          return;
        }

        if (!data.authenticated) {
          setState({
            loading: false,
            authenticated: false,
            user: null,
            error: authErrorMessage,
            deploymentEnvironment: data.deploymentEnvironment,
          });
          return;
        }

        setState({
          loading: false,
          authenticated: true,
          user: data.user,
          error: null,
          deploymentEnvironment: data.deploymentEnvironment,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message = authErrorMessage ?? (error instanceof Error ? error.message : "Failed to verify session");
        setState({
          loading: false,
          authenticated: false,
          user: null,
          error: message,
          deploymentEnvironment: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

export const useAuthSessionHeartbeat = (
  enabled: boolean,
  intervalMs: number = authSessionHeartbeatIntervalMs,
): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const checkSession = async (): Promise<void> => {
      try {
        const response = await fetch(resolveApiUrl("/auth/session"), {
          credentials: "include",
        });

        if (cancelled) {
          return;
        }

        if (isAuthFailureStatus(response.status)) {
          redirectToLogin();
        }
      } catch {
        // Ignore transient network errors; active API calls handle redirect on auth failures.
      }
    };

    void checkSession();

    const intervalId = window.setInterval(() => {
      void checkSession();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
};

export const logoutAndRedirectToLogin = (): void => {
  window.location.assign(resolveApiUrl("/auth/logout"));
};

export { redirectToLogin };
