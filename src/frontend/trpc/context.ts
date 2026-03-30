import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "backend/runtime/bootstrap/api-router";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
