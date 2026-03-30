# Frontend

## Purpose

Vite-based React SPA source.

## Allowed File Kinds

- React components and pages.
- Frontend routing/state modules.
- Frontend-only UI utilities/styles.
- API client adapters that call backend HTTP APIs.

## Rules

- Treat backend as a network boundary; no direct database or repo access.
- Keep browser concerns in frontend modules only.
- Share only cross-runtime contracts/utilities via `src/shared`.
- Local compose development uses bind mounts with Vite hot reload.
- Live Figma-backed screens should split into:
  - a dedicated `*View.tsx` file that owns the screen's presentational markup and stays visually close to the Figma page
    source
  - a container/page file that owns routing, tRPC/react-query reads, mutations, local state, and other app/runtime
    concerns
- Figma/app parity review should happen at source level by comparing each Figma page file to its app-side `*View.tsx`
  counterpart.
- When a Figma screen directly imports `components/ui/*`, port only those specific primitives into
  [`/src/frontend/components/ui/`](/src/frontend/components/ui/) and consume them from the app-side `*View.tsx`. Do not
  port unused Figma `ui` primitives preemptively.
- Queue-backed mutations must treat request success as "accepted" rather than "settled": track the returned starter job
  metadata, show pending state locally, and invalidate authoritative reads after the queue-backed work completes.

## Data Read Boundary

- All tRPC queries for display data MUST target retained starter routers such as `trpc.health.*`, `trpc.db.*`,
  `trpc.session.*`, and `trpc.jobs.*`.
- Keep frontend reads aligned with the starter app shell, database diagnostics, session state, and example worker flow.

## Disallowed Patterns

- Importing backend internals (`src/backend/*`).
- Embedding server-only secrets or runtime configuration handling in UI modules.

## Notes for Future Files

- Organize by feature first, then by technical type within feature folders.
