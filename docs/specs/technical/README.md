# Technical Specs

## Scope

Architecture and delivery specs for the volleyball league viewer app.

## Active Specs

- [`/docs/specs/technical/spreadsheet-ingestion.md`](/docs/specs/technical/spreadsheet-ingestion.md) — CLI + HTTP
  ingestion of thescoregr.com league spreadsheets.
- [`/docs/specs/technical/data-snapshots.md`](/docs/specs/technical/data-snapshots.md) — snapshot JSON format and
  archive layout.
- [`/docs/specs/technical/snapshot-storage.md`](/docs/specs/technical/snapshot-storage.md) — storage-backend port with
  filesystem (dev) and Vercel Blob (prod) adapters.
- [`/docs/specs/technical/runtime-ingestion.md`](/docs/specs/technical/runtime-ingestion.md) — admin-gated HTTP route
  handlers for ingest + rollback, rate-limited via a meta stamp.
- [`/docs/specs/technical/deployment.md`](/docs/specs/technical/deployment.md) — Next.js on Vercel Hobby, runtime
  ingestion against Blob, admin tool as primary refresh path.

## Related

- [`/docs/specs/README.md`](/docs/specs/README.md)
- [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md)
- [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md)
