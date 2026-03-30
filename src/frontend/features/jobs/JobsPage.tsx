import { useTRPC } from "@frontend/trpc/context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { JobsPageView, type JobsPageSignal } from "./JobsPageView";

const toSignalValue = (loading: boolean, error: string | null, value: string): string => {
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

export const JobsPageContainer = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const runsQuery = useQuery(trpc.jobs.listRuns.queryOptions({ limit: 10 }));
  const enqueueMutation = useMutation(
    trpc.jobs.enqueueExample.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.jobs.listRuns.queryKey({ limit: 10 }) });
      },
    }),
  );

  const runsError = runsQuery.error instanceof Error ? runsQuery.error.message : null;
  const enqueueError = enqueueMutation.error instanceof Error ? enqueueMutation.error.message : null;

  const signals: JobsPageSignal[] = [
    {
      label: "Queue adapter",
      value: "Graphile",
      detail: "The durable worker path stays part of the starter instead of being flattened away.",
    },
    {
      label: "Example job",
      value: "example.db_ping",
      detail: "This is the smallest durable job we can enqueue without dragging in product logic.",
    },
    {
      label: "Queued runs",
      value: toSignalValue(runsQuery.isLoading, runsError, String(runsQuery.data?.length ?? 0)),
      detail: runsError ?? "These are live Graphile-backed example jobs visible through the starter API.",
    },
    {
      label: "Mutation path",
      value: enqueueMutation.isPending ? "Enqueueing" : "Ready",
      detail: enqueueError ?? "The page can trigger the example worker flow end to end.",
    },
  ];

  const workflowNotes = [
    `${runsQuery.data?.length ?? 0} example jobs are currently visible in the queue.`,
    "Successful jobs should be simple enough to demonstrate the worker process without application-specific baggage.",
    "This page is intentionally operational: enqueue, inspect, and confirm the queue path is alive.",
  ];

  const futureQueueFeatures = ["enqueue example job", "live queue snapshot", "status + last error"];

  return (
    <JobsPageView
      signals={signals}
      workflowNotes={workflowNotes}
      futureQueueFeatures={futureQueueFeatures}
      runs={runsQuery.data ?? []}
      isEnqueueing={enqueueMutation.isPending}
      onEnqueue={() => {
        enqueueMutation.mutate();
      }}
      errorMessage={summarizeError(runsError, enqueueError)}
    />
  );
};

export const JobsPage = JobsPageContainer;
