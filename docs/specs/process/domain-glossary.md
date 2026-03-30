# Domain Glossary

## Spec Metadata

- ID: PR0010
- Type: Process
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Purpose

Map starter-facing UI labels, conversational terms, and implementation concepts to the current codebase.

## Maintenance Rules

- When a developer answers a terminology question or clarifies a concept during a session, add or update the relevant
  entry before the session ends.
- Prefer neutral starter language in reusable docs and code.
- Client, workflow, or data-source naming belongs in engagement-specific overlays rather than the baseline repository.

## Naming Conventions

| Prefer in Starter | Avoid in Starter Baseline          |
| ----------------- | ---------------------------------- |
| `starter`         | client or product brand names      |
| `dashboard`       | retired product page labels        |
| `jobs`            | domain-specific queue names        |
| `database`        | source-system-specific data labels |
| `settings`        | engagement-specific account terms  |

## Term Map

### UI Surface

| UI / Conversational Term | Code Location                                                                                            | Notes                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Dashboard                | [/src/frontend/features/dashboard/DashboardPage.tsx](/src/frontend/features/dashboard/DashboardPage.tsx) | Default authenticated landing page for the starter surface. |
| Database                 | [/src/frontend/features/database/DatabasePage.tsx](/src/frontend/features/database/DatabasePage.tsx)     | Operational page for database status and metadata.          |
| Jobs                     | [/src/frontend/features/jobs/JobsPage.tsx](/src/frontend/features/jobs/JobsPage.tsx)                     | Operational page for queued work visibility.                |
| Settings                 | [/src/frontend/features/settings/SettingsPage.tsx](/src/frontend/features/settings/SettingsPage.tsx)     | User and session-facing settings page.                      |

### Runtime Concepts

| Term            | Code Location                                                                              | Notes                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Read repo       | [/src/backend/runtime/ports/read.ts](/src/backend/runtime/ports/read.ts)                   | Query-side runtime contract consumed by services and handlers.             |
| Write repo      | [/src/backend/runtime/ports/write.ts](/src/backend/runtime/ports/write.ts)                 | Command-side runtime contract consumed by services and handlers.           |
| Example job     | [/src/backend/logic/services/example-jobs.ts](/src/backend/logic/services/example-jobs.ts) | Minimal queued job retained to exercise the worker surface in the starter. |
| Database status | [/src/backend/logic/services/db-status.ts](/src/backend/logic/services/db-status.ts)       | Service-layer entry for health and metadata shown on the database page.    |
| Session user    | [/src/backend/logic/services/session-me.ts](/src/backend/logic/services/session-me.ts)     | Canonical "who am I" session read used by the authenticated shell.         |

### Behavior Terms

| Term            | Source                                                                                           | Notes                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Accepted        | [/docs/specs/technical/platform-architecture.md](/docs/specs/technical/platform-architecture.md) | Request-time success means the write was committed and any follow-up work was enqueued.          |
| Settled         | [/docs/specs/technical/platform-architecture.md](/docs/specs/technical/platform-architecture.md) | Background work, if any, has completed and downstream reads are current.                         |
| Starter surface | [/docs/specs/README.md](/docs/specs/README.md)                                                   | The minimal authenticated app shell and runtime scaffolding intentionally retained in this repo. |
