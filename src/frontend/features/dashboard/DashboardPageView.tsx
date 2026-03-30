import type { ReactNode } from "react";

export interface DashboardPageStat {
  label: string;
  value: string;
  detail: string;
}

interface DashboardPageViewProps {
  stats: DashboardPageStat[];
  checkpoints: string[];
  operationalHighlights: string[];
  errorMessage: string | null;
}

const SectionCard = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <section className="rounded-[20px] border border-[#d6dbe3] bg-white p-[24px] shadow-[0_10px_30px_rgba(4,30,65,0.06)]">
    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5b6779]">{eyebrow}</p>
    <h2 className="mt-[8px] text-[22px] font-semibold text-[#041e41]">{title}</h2>
    <div className="mt-[16px]">{children}</div>
  </section>
);

export const DashboardPageView = ({
  stats,
  checkpoints,
  operationalHighlights,
  errorMessage,
}: DashboardPageViewProps) => {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#e9edf3_0%,#f6f8fb_100%)]">
      <div className="px-[40px] py-[32px] max-[720px]:px-4">
        <header className="mb-[24px] max-w-[920px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#5b6779]">Starter overview</p>
          <h1 className="mt-[8px] text-[36px] font-semibold tracking-[-0.03em] text-[#041e41] max-[720px]:text-[30px]">
            Dashboard
          </h1>
          <p className="mt-[12px] max-w-[760px] text-[16px] leading-[1.6] text-[#506072]">
            This landing page now proves the starter stack end to end: authenticated app shell, backend reachability,
            Drizzle-backed metadata reads, and Graphile queue visibility.
          </p>
          {errorMessage ? (
            <div className="mt-[16px] rounded-[16px] border border-[#f0c2c2] bg-[#fff5f5] px-[16px] py-[14px] text-[14px] text-[#8d2f2f]">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <section className="grid gap-[16px] sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-[18px] border border-[#d6dbe3] bg-white p-[20px] shadow-[0_8px_24px_rgba(4,30,65,0.05)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5b6779]">{stat.label}</p>
              <p className="mt-[12px] text-[28px] font-semibold text-[#041e41]">{stat.value}</p>
              <p className="mt-[10px] text-[14px] leading-[1.55] text-[#506072]">{stat.detail}</p>
            </article>
          ))}
        </section>

        <div className="mt-[16px] grid gap-[16px] lg:grid-cols-[1.1fr_0.9fr]">
          <SectionCard eyebrow="Live checks" title="What the starter is proving right now">
            <ul className="space-y-[12px]">
              {checkpoints.map((item) => (
                <li key={item} className="flex gap-[12px] text-[15px] leading-[1.55] text-[#36465b]">
                  <span className="mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#1f6feb]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard eyebrow="Operational lens" title="Small signals future teams should notice">
            <ul className="space-y-[12px]">
              {operationalHighlights.map((item) => (
                <li key={item} className="flex gap-[12px] text-[15px] leading-[1.55] text-[#36465b]">
                  <span className="mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#1f6feb]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
