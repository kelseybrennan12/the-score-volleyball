import { resolveSnapshotRepo } from "@/backend/runtime/adapters/snapshots";
import { AdminGate } from "@/components/admin-gate";
import { ViewerApp } from "@/components/viewer-app";
import type { Snapshot } from "@/shared/domain/snapshot";

export const dynamic = "force-dynamic";

async function loadSnapshots(): Promise<Snapshot[]> {
  const repo = resolveSnapshotRepo();
  const snapshots = await repo.listActive();
  return snapshots.sort((a, b) => a.league.displayName.localeCompare(b.league.displayName));
}

export default async function HomePage() {
  const snapshots = await loadSnapshots();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <AdminGate>
          <h1 className="text-2xl font-semibold select-none">The Score Beach Volleyball League Viewer</h1>
        </AdminGate>
        <p className="mt-1 text-sm text-neutral-600">Pick your league day, find your team, and see your next match.</p>
      </header>
      <ViewerApp snapshots={snapshots} />
      <footer className="mt-10 space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>
          We do our best to accurately reflect each team&rsquo;s schedule, but use this app at your own risk — the
          league&rsquo;s{" "}
          <a
            href="https://www.thescoregr.com/volleyball/beach-volleyball-leagues/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-neutral-700"
          >
            spreadsheets
          </a>{" "}
          remain the source of truth.
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span>
            Data from{" "}
            <a
              href="https://www.thescoregr.com/volleyball/beach-volleyball-leagues/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-neutral-700"
            >
              The Score Grand Rapids beach volleyball standings
            </a>
            .
          </span>
          <span>
            Built by{" "}
            <a
              href="https://github.com/kelseybrennan12"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-neutral-700"
            >
              Kelsey Brennan
            </a>
            .
          </span>
        </div>
      </footer>
    </main>
  );
}
