import { useTRPC } from "@frontend/trpc/context";
import { useQuery } from "@tanstack/react-query";
import { DashboardPageView, type DashboardPageStat } from "./DashboardPageView";

const toStatusValue = (loading: boolean, error: string | null, value: string): string => {
  if (loading) {
    return "Loading";
  }

  if (error) {
    return "Issue";
  }

  return value;
};

const summarizeQueryError = (...messages: Array<string | null>): string | null => {
  return messages.find((message) => typeof message === "string" && message.length > 0) ?? null;
};

const formatRunAt = (value: string | null): string => {
  if (!value) {
    return "No queued example jobs right now.";
  }

  return `Latest queue activity at ${new Date(value).toLocaleString()}.`;
};

export const DashboardPageContainer = () => {
  const trpc = useTRPC();
  const healthQuery = useQuery(trpc.health.status.queryOptions());
  const dbStatusQuery = useQuery(trpc.db.status.queryOptions());
  const runsQuery = useQuery(trpc.jobs.listRuns.queryOptions({ limit: 5 }));
  const sessionQuery = useQuery(trpc.session.me.queryOptions());

  const healthError = healthQuery.error instanceof Error ? healthQuery.error.message : null;
  const dbError = dbStatusQuery.error instanceof Error ? dbStatusQuery.error.message : null;
  const runsError = runsQuery.error instanceof Error ? runsQuery.error.message : null;
  const sessionError = sessionQuery.error instanceof Error ? sessionQuery.error.message : null;

  const latestRun = runsQuery.data?.[0] ?? null;
  const stats: DashboardPageStat[] = [
    {
      label: "API health",
      value: toStatusValue(healthQuery.isLoading, healthError, healthQuery.data?.status === "ok" ? "OK" : "Unknown"),
      detail: healthError ?? "The starter API is reachable through the preserved tRPC and HTTP shell.",
    },
    {
      label: "Database",
      value: toStatusValue(dbStatusQuery.isLoading, dbError, dbStatusQuery.data?.databaseName ?? "Connected"),
      detail:
        dbError ??
        `Schema ${dbStatusQuery.data?.currentSchema ?? "unknown"} via Drizzle metadata queries in the backend layer.`,
    },
    {
      label: "Example jobs",
      value: toStatusValue(runsQuery.isLoading, runsError, String(runsQuery.data?.length ?? 0)),
      detail: runsError ?? formatRunAt(latestRun?.runAt ?? null),
    },
    {
      label: "Signed-in role",
      value: toStatusValue(sessionQuery.isLoading, sessionError, sessionQuery.data?.user.role ?? "Unknown"),
      detail: sessionError ?? `Authenticated as ${sessionQuery.data?.user.displayName ?? "the current user"}.`,
    },
  ];

  const checkpoints = [
    `Health route: ${healthQuery.data?.service ?? "api"} is ${healthQuery.data?.status ?? "still loading"}.`,
    `Database target: ${dbStatusQuery.data?.databaseName ?? "pending"} / ${dbStatusQuery.data?.currentSchema ?? "pending"}.`,
    `${runsQuery.data?.length ?? 0} example Graphile jobs currently visible through the starter backend.`,
  ];

  const operationalHighlights = [
    `Worker schema: ${dbStatusQuery.data?.graphileSchema ?? "pending"}.`,
    `Database server time: ${dbStatusQuery.data?.serverTime ? new Date(dbStatusQuery.data.serverTime).toLocaleString() : "pending"}.`,
    `Session context: ${sessionQuery.data?.user.email ?? "pending"}.`,
  ];

  return (
    <DashboardPageView
      stats={stats}
      checkpoints={checkpoints}
      operationalHighlights={operationalHighlights}
      errorMessage={summarizeQueryError(healthError, dbError, runsError, sessionError)}
    />
  );
};

export const DashboardPage = DashboardPageContainer;
