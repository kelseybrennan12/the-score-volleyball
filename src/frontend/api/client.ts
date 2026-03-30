import { withCorrelationHeader } from "@frontend/api/correlation";
import { resolveApiUrl } from "@frontend/api/urls";
import { isAuthFailureStatus, redirectToLogin } from "@frontend/auth/redirect";

interface ApiFetchOptions extends RequestInit {
  skipJsonParse?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipJsonParse, ...fetchOptions } = options;
  const res = await fetch(resolveApiUrl(path), {
    ...fetchOptions,
    credentials: "include",
    headers: withCorrelationHeader(fetchOptions.headers),
  });

  if (isAuthFailureStatus(res.status)) {
    redirectToLogin();
  }

  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);

  if (skipJsonParse) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
