import { createSnapshotRepo } from "@/backend/runtime/adapters/snapshots/fs";
import { ViewerApp } from "@/components/viewer-app";
import type { Snapshot } from "@/shared/domain/snapshot";
import path from "node:path";

export const dynamic = "force-static";

async function loadSnapshots(): Promise<Snapshot[]> {
  const repo = createSnapshotRepo(path.join(process.cwd(), "data/snapshots"));
  const snapshots = await repo.listActive();
  return snapshots.sort((a, b) => a.league.displayName.localeCompare(b.league.displayName));
}

export default async function HomePage() {
  const snapshots = await loadSnapshots();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Volleyball League Viewer</h1>
        <p className="mt-1 text-sm text-neutral-600">Pick your league day, find your team, and see your next match.</p>
      </header>
      <ViewerApp snapshots={snapshots} />
    </main>
  );
}
