import { AppShell } from "@frontend/App";
import { DashboardPage } from "@frontend/features/dashboard/DashboardPage";
import { DatabasePage } from "@frontend/features/database/DatabasePage";
import { JobsPage } from "@frontend/features/jobs/JobsPage";
import { SettingsPage } from "@frontend/features/settings/SettingsPage";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const databaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/database",
  component: DatabasePage,
});

const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jobs",
  component: JobsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, dashboardRoute, databaseRoute, jobsRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
