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
          <h1 className="text-2xl font-semibold select-none">Volleyball League Viewer</h1>
        </AdminGate>
        <p className="mt-1 text-sm text-neutral-600">Pick your league day, find your team, and see your next match.</p>
      </header>
      <ViewerApp snapshots={snapshots} />
      <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
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
      </footer>
    </main>
  );
}
