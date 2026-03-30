# Backend Integrations

## Purpose

Adapters around external systems and third-party data sources.

## Allowed File Kinds

- External API client wrappers.
- Integration request/response mappers.
- Retry/backoff and integration-specific error translation helpers.

## Rules

- Integrations encapsulate external IO details.
- Services do not call integrations directly; integration-heavy work runs in jobs.
- Integration modules do not directly access DB adapters.
- Every integration must include a healthcheck job handler registered in the cron schedule.
- Integrations should surface expected provider outcomes as typed results (including retryability metadata) rather than
  requiring callers to parse expected errors from thrown exceptions.

## Disallowed Patterns

- Embedding domain orchestration that belongs in services/jobs.
- Importing repo implementation internals or DB clients directly.

## Notes for Future Files

- Keep side effects explicit and map external schemas to internal plain values.
