import type { ReactNode } from "react";

export interface DatabasePageMetric {
  label: string;
  value: string;
  detail: string;
}

interface DatabasePageTable {
  schemaName: string;
  tableName: string;
  tableType: string;
}

interface DatabasePageViewProps {
  metrics: DatabasePageMetric[];
  readinessNotes: string[];
  safeChecks: string[];
  schemas: string[];
  tables: DatabasePageTable[];
  errorMessage: string | null;
}

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-[20px] border border-[#d6dbe3] bg-white p-[24px] shadow-[0_10px_30px_rgba(4,30,65,0.06)]">
    <h2 className="text-[20px] font-semibold text-[#041e41]">{title}</h2>
    <div className="mt-[16px]">{children}</div>
  </section>
);

export const DatabasePageView = ({
  metrics,
  readinessNotes,
  safeChecks,
  schemas,
  tables,
  errorMessage,
}: DatabasePageViewProps) => {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3f9_0%,#f8fafc_100%)]">
      <div className="px-[40px] py-[32px] max-[720px]:px-4">
        <header className="mb-[24px] max-w-[920px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#5b6779]">Database prove-out</p>
          <h1 className="mt-[8px] text-[36px] font-semibold tracking-[-0.03em] text-[#041e41] max-[720px]:text-[30px]">
            Database
          </h1>
          <p className="mt-[12px] max-w-[780px] text-[16px] leading-[1.6] text-[#506072]">
            This page proves the starter can reach Postgres safely through Drizzle without assuming any application
            tables exist yet.
          </p>
          {errorMessage ? (
            <div className="mt-[16px] rounded-[16px] border border-[#f0c2c2] bg-[#fff5f5] px-[16px] py-[14px] text-[14px] text-[#8d2f2f]">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <section className="grid gap-[16px] sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-[18px] border border-[#d6dbe3] bg-white p-[20px] shadow-[0_8px_24px_rgba(4,30,65,0.05)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5b6779]">{metric.label}</p>
              <p className="mt-[12px] text-[28px] font-semibold text-[#041e41]">{metric.value}</p>
              <p className="mt-[10px] text-[14px] leading-[1.55] text-[#506072]">{metric.detail}</p>
            </article>
          ))}
        </section>

        <div className="mt-[16px] grid gap-[16px] lg:grid-cols-[1fr_0.9fr]">
          <Panel title="Starter-safe checks">
            <ul className="space-y-[12px]">
              {safeChecks.map((item) => (
                <li
                  key={item}
                  className="rounded-[14px] border border-[#e4e9f0] bg-[#f8fafc] px-[16px] py-[12px] text-[14px] text-[#36465b]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Live database notes">
            <ul className="space-y-[12px]">
              {readinessNotes.map((item) => (
                <li key={item} className="flex gap-[12px] text-[15px] leading-[1.55] text-[#36465b]">
                  <span className="mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#1f6feb]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="mt-[16px] grid gap-[16px] lg:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Discovered schemas">
            <div className="flex flex-wrap gap-[10px]">
              {schemas.length > 0 ? (
                schemas.map((schemaName) => (
                  <span
                    key={schemaName}
                    className="rounded-full border border-[#d6dbe3] bg-[#f8fafc] px-[14px] py-[8px] text-[14px] text-[#36465b]"
                  >
                    {schemaName}
                  </span>
                ))
              ) : (
                <p className="text-[14px] text-[#506072]">No schemas are visible yet.</p>
              )}
            </div>
          </Panel>

          <Panel title="Visible tables">
            <div className="space-y-[10px]">
              {tables.length > 0 ? (
                tables.map((table) => (
                  <div
                    key={`${table.schemaName}.${table.tableName}`}
                    className="rounded-[14px] border border-[#e4e9f0] bg-[#f8fafc] px-[16px] py-[12px]"
                  >
                    <p className="text-[14px] font-semibold text-[#041e41]">
                      {table.schemaName}.{table.tableName}
                    </p>
                    <p className="mt-[4px] text-[13px] text-[#506072]">{table.tableType}</p>
                  </div>
                ))
              ) : (
                <p className="text-[14px] text-[#506072]">No tables returned by metadata discovery yet.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
