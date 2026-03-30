import { router } from "@frontend/router/router";
import "@frontend/tailwind.css";
import { createFrontendTrpcClient } from "@frontend/trpc/client";
import { TRPCProvider } from "@frontend/trpc/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

const queryClient = new QueryClient();
const trpcClient = createFrontendTrpcClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
