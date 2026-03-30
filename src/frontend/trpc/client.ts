import { withCorrelationHeader } from "@frontend/api/correlation";
import { resolveApiUrl } from "@frontend/api/urls";
import { redirectToLogin, responseHasTrpcAuthFailure } from "@frontend/auth/redirect";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "backend/runtime/bootstrap/api-router";

export const createFrontendTrpcClient = () => {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: resolveApiUrl("/trpc"),
        fetch: (url, options) => {
          const headers = withCorrelationHeader(options?.headers);
          return fetch(url, {
            ...options,
            credentials: "include",
            headers,
          }).then(async (response) => {
            if (await responseHasTrpcAuthFailure(response)) {
              redirectToLogin();
            }

            return response;
          });
        },
      }),
    ],
  });
};
