import type { AuthenticatedRequestContext } from "backend/runtime/adapters/infra/auth";

export interface SessionMeResult {
  authenticated: true;
  sessionId: string;
  user: {
    id: string;
    tenantId: string;
    email: string | null;
    displayName: string | null;
    role: string;
    isAuthorized: boolean;
    isActive: boolean;
  };
}

export const getSessionMe = (authContext: AuthenticatedRequestContext): SessionMeResult => {
  return {
    authenticated: true,
    sessionId: authContext.sessionId,
    user: {
      id: authContext.user.id,
      tenantId: authContext.user.tenantId,
      email: authContext.user.email,
      displayName: authContext.user.displayName,
      role: authContext.user.role,
      isAuthorized: authContext.user.isAuthorized,
      isActive: authContext.user.isActive,
    },
  };
};
