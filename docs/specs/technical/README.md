# Technical Specs

## Scope

This folder contains the technical baseline for the starter repository: runtime architecture, authentication, delivery,
dependency hygiene, and operational visibility.

Legacy source-system and product-domain pipeline specs were intentionally removed during the starter cleanup. Add new
technical specs here only when they describe reusable repository architecture or operating constraints.

## Active Specs

- [`/docs/specs/technical/platform-architecture.md`](/docs/specs/technical/platform-architecture.md)
- [`/docs/specs/technical/authentication-and-session-architecture.md`](/docs/specs/technical/authentication-and-session-architecture.md)
- [`/docs/specs/technical/delivery-pipeline.md`](/docs/specs/technical/delivery-pipeline.md)
- [`/docs/specs/technical/dependency-currency.md`](/docs/specs/technical/dependency-currency.md)
- [`/docs/specs/technical/jobs-operational-visibility.md`](/docs/specs/technical/jobs-operational-visibility.md)
- [`/docs/specs/technical/spreadsheet-ingestion.md`](/docs/specs/technical/spreadsheet-ingestion.md) — CLI ingestion of
  thescoregr.com league spreadsheets.
- [`/docs/specs/technical/data-snapshots.md`](/docs/specs/technical/data-snapshots.md) — on-disk snapshot format and
  archive layout.
- [`/docs/specs/technical/deployment.md`](/docs/specs/technical/deployment.md) — Next.js on Vercel Hobby, build-time
  snapshots, ingest-then-commit workflow.

## Related

- [`/docs/specs/README.md`](/docs/specs/README.md)
- [`/docs/specs/operations/observability.md`](/docs/specs/operations/observability.md)
- [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md)
- [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md)
