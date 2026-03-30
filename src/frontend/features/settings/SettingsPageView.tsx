import type { ReactNode } from "react";

export interface SettingsPageTopic {
  label: string;
  value: string;
  detail: string;
}

interface SettingsPageViewProps {
  topics: SettingsPageTopic[];
  settingsNotes: string[];
  starterDefaults: string[];
  errorMessage: string | null;
}

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-[20px] border border-[#d6dbe3] bg-white p-[24px] shadow-[0_10px_30px_rgba(4,30,65,0.06)]">
    <h2 className="text-[20px] font-semibold text-[#041e41]">{title}</h2>
    <div className="mt-[16px]">{children}</div>
  </section>
);

export const SettingsPageView = ({ topics, settingsNotes, starterDefaults, errorMessage }: SettingsPageViewProps) => {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef2f7_0%,#fbfcfe_100%)]">
      <div className="px-[40px] py-[32px] max-[720px]:px-4">
        <header className="mb-[24px] max-w-[920px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#5b6779]">Starter controls</p>
          <h1 className="mt-[8px] text-[36px] font-semibold tracking-[-0.03em] text-[#041e41] max-[720px]:text-[30px]">
            Settings
          </h1>
          <p className="mt-[12px] max-w-[780px] text-[16px] leading-[1.6] text-[#506072]">
            This page makes the starter's current identity, environment, and auth/session shape easy to inspect during a
            fresh project bootstrap.
          </p>
          {errorMessage ? (
            <div className="mt-[16px] rounded-[16px] border border-[#f0c2c2] bg-[#fff5f5] px-[16px] py-[14px] text-[14px] text-[#8d2f2f]">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <section className="grid gap-[16px] sm:grid-cols-2 xl:grid-cols-4">
          {topics.map((topic) => (
            <article
              key={topic.label}
              className="rounded-[18px] border border-[#d6dbe3] bg-white p-[20px] shadow-[0_8px_24px_rgba(4,30,65,0.05)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5b6779]">{topic.label}</p>
              <p className="mt-[12px] text-[28px] font-semibold text-[#041e41]">{topic.value}</p>
              <p className="mt-[10px] text-[14px] leading-[1.55] text-[#506072]">{topic.detail}</p>
            </article>
          ))}
        </section>

        <div className="mt-[16px] grid gap-[16px] lg:grid-cols-[1fr_0.9fr]">
          <Panel title="Current starter diagnostics">
            <ul className="space-y-[12px]">
              {settingsNotes.map((item) => (
                <li key={item} className="flex gap-[12px] text-[15px] leading-[1.55] text-[#36465b]">
                  <span className="mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#1f6feb]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Defaults retained in the starter">
            <div className="flex flex-wrap gap-[10px]">
              {starterDefaults.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#d6dbe3] bg-[#f8fafc] px-[14px] py-[8px] text-[14px] text-[#36465b]"
                >
                  {item}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
