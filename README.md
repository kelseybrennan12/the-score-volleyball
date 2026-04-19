# Volleyball League Viewer

A single-page Next.js app that surfaces team schedules, records, ranks, and next matches from thescoregr.com beach
volleyball league spreadsheets. Data is ingested from Google Sheets via a CLI, cached as per-league JSON snapshots in
this repo, and served by a static Next.js page deployable on Vercel Hobby.

## Developer Commands

- `mise run dev` — start the Next.js dev server on `http://localhost:3000`.
- `mise run build` — production build.
- `mise run ingest` — refresh all league snapshots from Google Sheets.
  - `mise run ingest -- --dry-run` — parse without writing.
  - `mise run ingest -- --league spring-sundays` — ingest a single league.
- `mise run test` — unit and integration tests.
- `mise run lint`, `mise run typecheck`, `mise run fmt-check`.

## Data Refresh Workflow

The app does not call Google Sheets at runtime. Production data refresh:

1. Run `mise run ingest` locally.
2. Review the resulting changes under `data/snapshots/`.
3. Commit the snapshot changes.
4. Push to `main` — Vercel redeploys automatically.

See [`/docs/specs/technical/deployment.md`](/docs/specs/technical/deployment.md) for the full deployment topology.

## Specs and Process

- Product specs: [`/docs/specs/product/`](/docs/specs/product/)
- Technical specs: [`/docs/specs/technical/`](/docs/specs/technical/)
- Process docs: [`/docs/specs/process/`](/docs/specs/process/)
- Agent workflow: [`/AGENTS.md`](/AGENTS.md)
