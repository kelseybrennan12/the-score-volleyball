import type { ReactNode } from "react";

export interface JobsPageSignal {
  label: string;
  value: string;
  detail: string;
}

interface JobsPageRun {
  backendJobId: string;
  jobType: string;
  queueName: string | null;
  runAt: string | null;
  createdAt: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  status: "pending" | "processing" | "completed" | "failed";
}

interface JobsPageViewProps {
  signals: JobsPageSignal[];
  workflowNotes: string[];
  futureQueueFeatures: string[];
  runs: JobsPageRun[];
  isEnqueueing: boolean;
  onEnqueue: () => void;
  errorMessage: string | null;
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-[20px] border border-[#d6dbe3] bg-white p-[24px] shadow-[0_10px_30px_rgba(4,30,65,0.06)]">
    <h2 className="text-[20px] font-semibold text-[#041e41]">{title}</h2>
    <div className="mt-[16px]">{children}</div>
  </section>
);

const statusClassName: Record<JobsPageRun["status"], string> = {
  pending: "border-[#d6dbe3] bg-[#f8fafc] text-[#36465b]",
  processing: "border-[#cde1f5] bg-[#eef6ff] text-[#184c7a]",
  completed: "border-[#cfe7d0] bg-[#f2faf2] text-[#2f6b35]",
  failed: "border-[#f0c2c2] bg-[#fff5f5] text-[#8d2f2f]",
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
};

export const JobsPageView = ({
  signals,
  workflowNotes,
  futureQueueFeatures,
  runs,
  isEnqueueing,
  onEnqueue,
  errorMessage,
}: JobsPageViewProps) => {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0f4f8_0%,#fafbfd_100%)]">
      <div className="px-[40px] py-[32px] max-[720px]:px-4">
        <header className="mb-[24px] max-w-[920px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#5b6779]">Worker visibility</p>
          <div className="flex flex-wrap items-end justify-between gap-[16px]">
            <div className="max-w-[780px]">
              <h1 className="mt-[8px] text-[36px] font-semibold tracking-[-0.03em] text-[#041e41] max-[720px]:text-[30px]">
                Jobs
              </h1>
              <p className="mt-[12px] text-[16px] leading-[1.6] text-[#506072]">
                This screen is the starter-facing operational view for Graphile-backed work. It lets future projects
                confirm the durable queue path before any domain-specific jobs exist.
              </p>
            </div>
            <button
              className="inline-flex min-h-[44px] items-center justify-center rounded-[999px] bg-[#1f6feb] px-[18px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-[#1657b8] disabled:cursor-not-allowed disabled:bg-[#8fb7ef]"
              disabled={isEnqueueing}
              onClick={onEnqueue}
              type="button"
            >
              {isEnqueueing ? "Enqueueing example job..." : "Enqueue example job"}
            </button>
          </div>
          {errorMessage ? (
            <div className="mt-[16px] rounded-[16px] border border-[#f0c2c2] bg-[#fff5f5] px-[16px] py-[14px] text-[14px] text-[#8d2f2f]">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <section className="grid gap-[16px] sm:grid-cols-2 xl:grid-cols-4">
          {signals.map((signal) => (
            <article
              key={signal.label}
              className="rounded-[18px] border border-[#d6dbe3] bg-white p-[20px] shadow-[0_8px_24px_rgba(4,30,65,0.05)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5b6779]">{signal.label}</p>
              <p className="mt-[12px] text-[28px] font-semibold text-[#041e41]">{signal.value}</p>
              <p className="mt-[10px] text-[14px] leading-[1.55] text-[#506072]">{signal.detail}</p>
            </article>
          ))}
        </section>

        <div className="mt-[16px] grid gap-[16px] lg:grid-cols-[1fr_0.9fr]">
          <Card title="How the starter queue should feel">
            <ul className="space-y-[12px]">
              {workflowNotes.map((item) => (
                <li key={item} className="flex gap-[12px] text-[15px] leading-[1.55] text-[#36465b]">
                  <span className="mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#1f6feb]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Starter job capabilities">
            <div className="flex flex-wrap gap-[10px]">
              {futureQueueFeatures.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#d6dbe3] bg-[#f8fafc] px-[14px] py-[8px] text-[14px] text-[#36465b]"
                >
                  {item}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-[16px]">
          <Card title="Current example runs">
            <div className="space-y-[12px]">
              {runs.length > 0 ? (
                runs.map((run) => (
                  <article
                    key={run.backendJobId}
                    className="rounded-[16px] border border-[#e4e9f0] bg-[#f8fafc] px-[16px] py-[14px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-[10px]">
                      <div>
                        <p className="text-[15px] font-semibold text-[#041e41]">{run.jobType}</p>
                        <p className="mt-[4px] text-[13px] text-[#506072]">
                          job {run.backendJobId} · queue {run.queueName ?? "default"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-[12px] py-[6px] text-[12px] font-semibold uppercase tracking-[0.14em] ${statusClassName[run.status]}`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-[12px] grid gap-[10px] sm:grid-cols-3">
                      <p className="text-[13px] text-[#36465b]">Run at: {formatDateTime(run.runAt)}</p>
                      <p className="text-[13px] text-[#36465b]">Created: {formatDateTime(run.createdAt)}</p>
                      <p className="text-[13px] text-[#36465b]">
                        Attempts: {run.attempts}/{run.maxAttempts}
                      </p>
                    </div>
                    {run.lastError ? (
                      <p className="mt-[10px] text-[13px] text-[#8d2f2f]">Last error: {run.lastError}</p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-[14px] text-[#506072]">
                  No example jobs are queued right now. Use the button above to create one.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
