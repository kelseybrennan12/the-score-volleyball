import { resolveApiUrl } from "@frontend/api/urls";

const unauthorizedHttpStatus = 401;

let loginRedirectInProgress = false;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isTrpcEnvelopeUnauthorized = (payload: unknown): boolean => {
  if (!isRecord(payload)) {
    return false;
  }

  const error = payload.error;
  if (!isRecord(error)) {
    return false;
  }

  const data = error.data;
  if (!isRecord(data)) {
    return false;
  }

  return data.code === "UNAUTHORIZED" || data.httpStatus === unauthorizedHttpStatus;
};

export const isAuthFailureStatus = (statusCode: number): boolean => {
  return statusCode === unauthorizedHttpStatus;
};

export const redirectToLogin = (): void => {
  if (loginRedirectInProgress) {
    return;
  }

  loginRedirectInProgress = true;
  window.location.assign(resolveApiUrl("/auth/login"));
};

export const responseHasTrpcAuthFailure = async (response: Response): Promise<boolean> => {
  if (isAuthFailureStatus(response.status)) {
    return true;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return false;
  }

  try {
    const payload: unknown = await response.clone().json();

    if (Array.isArray(payload)) {
      return payload.some((entry) => isTrpcEnvelopeUnauthorized(entry));
    }

    return isTrpcEnvelopeUnauthorized(payload);
  } catch {
    return false;
  }
};
