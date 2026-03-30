import { useTRPC } from "@frontend/trpc/context";
import { useQuery } from "@tanstack/react-query";
import { DatabasePageView, type DatabasePageMetric } from "./DatabasePageView";

const toMetricValue = (loading: boolean, error: string | null, value: string): string => {
  if (loading) {
    return "Loading";
  }

  if (error) {
    return "Issue";
  }

  return value;
};

const summarizeError = (...messages: Array<string | null>): string | null => {
  return messages.find((message) => typeof message === "string" && message.length > 0) ?? null;
};

export const DatabasePageContainer = () => {
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.db.status.queryOptions());
  const metadataQuery = useQuery(trpc.db.metadata.queryOptions({ limit: 12 }));

  const statusError = statusQuery.error instanceof Error ? statusQuery.error.message : null;
  const metadataError = metadataQuery.error instanceof Error ? metadataQuery.error.message : null;

  const metrics: DatabasePageMetric[] = [
    {
      label: "Connection mode",
      value: toMetricValue(statusQuery.isLoading, statusError, statusQuery.data?.databaseName ?? "Connected"),
      detail: statusError ?? `Current schema: ${statusQuery.data?.currentSchema ?? "pending"}.`,
    },
    {
      label: "Graphile schema",
      value: toMetricValue(statusQuery.isLoading, statusError, statusQuery.data?.graphileSchema ?? "pending"),
      detail: "Queue infrastructure remains visible without assuming app business tables.",
    },
    {
      label: "Schemas found",
      value: toMetricValue(metadataQuery.isLoading, metadataError, String(metadataQuery.data?.schemas.length ?? 0)),
      detail: metadataError ?? "Read-only catalog discovery comes through the backend service layer.",
    },
    {
      label: "Tables listed",
      value: toMetricValue(metadataQuery.isLoading, metadataError, String(metadataQuery.data?.tables.length ?? 0)),
      detail: metadataError ?? "This is intentionally metadata only so the starter does not assume your schema.",
    },
  ];

  const readinessNotes = [
    `Server time: ${statusQuery.data?.serverTime ? new Date(statusQuery.data.serverTime).toLocaleString() : "pending"}.`,
    `Version check: ${statusQuery.data?.version ? "available" : "pending"}.`,
    `${metadataQuery.data?.schemas.length ?? 0} non-system schemas discovered for starter visibility.`,
  ];

  const safeChecks = [
    "current_database() / current_schema()",
    "server version and runtime info",
    "information_schema table discovery",
  ];

  return (
    <DatabasePageView
      metrics={metrics}
      readinessNotes={readinessNotes}
      safeChecks={safeChecks}
      schemas={metadataQuery.data?.schemas ?? []}
      tables={metadataQuery.data?.tables ?? []}
      errorMessage={summarizeError(statusError, metadataError)}
    />
  );
};

export const DatabasePage = DatabasePageContainer;
