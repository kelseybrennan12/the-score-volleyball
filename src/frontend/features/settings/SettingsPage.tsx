import { useAuthSession } from "@frontend/auth/useAuthSession";
import { useTRPC } from "@frontend/trpc/context";
import { useQuery } from "@tanstack/react-query";
import { SettingsPageView, type SettingsPageTopic } from "./SettingsPageView";

const summarizeError = (...messages: Array<string | null>): string | null => {
  return messages.find((message) => typeof message === "string" && message.length > 0) ?? null;
};

export const SettingsPageContainer = () => {
  const auth = useAuthSession();
  const trpc = useTRPC();
  const sessionQuery = useQuery(trpc.session.me.queryOptions());
  const dbStatusQuery = useQuery(trpc.db.status.queryOptions());

  const sessionError = sessionQuery.error instanceof Error ? sessionQuery.error.message : null;
  const dbError = dbStatusQuery.error instanceof Error ? dbStatusQuery.error.message : null;

  const topics: SettingsPageTopic[] = [
    {
      label: "Identity",
      value: sessionQuery.data?.user.displayName ?? auth.user?.displayName ?? "Project Starter",
      detail: "The starter keeps authenticated identity visible without carrying the previous client domain.",
    },
    {
      label: "Environment",
      value: auth.deploymentEnvironment ?? "unknown",
      detail: "Deployment naming stays generic so future projects can retarget infra without rewriting the app shell.",
    },
    {
      label: "Session",
      value: sessionQuery.data?.sessionId ? "Active" : auth.loading ? "Loading" : "Unavailable",
      detail: sessionError ?? `Role: ${sessionQuery.data?.user.role ?? auth.user?.role ?? "unknown"}.`,
    },
    {
      label: "Worker schema",
      value: dbStatusQuery.data?.graphileSchema ?? "pending",
      detail: dbError ?? "Graphile remains part of the platform stance for the stripped starter.",
    },
  ];

  const settingsNotes = [
    `Tenant: ${sessionQuery.data?.user.tenantId ?? auth.user?.tenantId ?? "pending"}.`,
    `Email: ${sessionQuery.data?.user.email ?? auth.user?.email ?? "pending"}.`,
    `Database schema hint: ${dbStatusQuery.data?.currentSchema ?? "pending"}.`,
  ];

  const starterDefaults = [
    `app name: project-starter`,
    `env: ${auth.deploymentEnvironment ?? "unknown"}`,
    `provider packs: optional`,
    `skills + figma workflow: retained`,
  ];

  return (
    <SettingsPageView
      topics={topics}
      settingsNotes={settingsNotes}
      starterDefaults={starterDefaults}
      errorMessage={summarizeError(sessionError, dbError, auth.error)}
    />
  );
};

export const SettingsPage = SettingsPageContainer;
