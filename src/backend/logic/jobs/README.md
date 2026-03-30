# Backend Jobs

## Purpose

Asynchronous and slow-running workflows, including ingestion and integration-heavy processing.

## Allowed File Kinds

- Job handlers/workers.
- Scheduling or trigger adapters.
- Job orchestration modules that coordinate services, repos, and integrations.

## Rules

- Jobs are outside request/response latency-critical paths.
- Jobs may use repo interfaces and service entrypoints, but not repo implementation internals.
- Jobs must not access DB adapters directly.
- Transactional writes in jobs use repo transaction callback APIs.
- Job handlers follow `read -> core -> write` orchestration.
- Job handlers flush writes/enqueues/logs from core decision outputs unconditionally.
- Projector-backed DAG handlers should prefer the shared
  [`projector-handler.ts`](/src/backend/logic/jobs/projector-handler.ts) shell for
  `decode -> transaction -> enqueue -> assert -> log` flow when the job is primarily a projector runner.
- Keep write boundaries coarse: avoid `withTransaction` calls inside loops and prefer one terminal DB write transaction
  per success/failure execution path.
- Handler files may contain multiple exported handlers; each handler function should own its own explicit transaction
  boundary.
- Prefer small, composable jobs; realize concurrency by enqueueing multiple independent job requests.
- Keep conditional domain logic in `src/backend/logic/core/`; job handlers should not encode branching business rules.
- Keep handler-specific completion log payloads explicit at the callsite even when using shared shell helpers; shared
  wrappers own lifecycle scaffolding, not domain event naming.
- Queue job handlers (for example `example-db-ping`) live under `src/backend/logic/jobs/handlers/`.
- Runner mechanism internals (queue adapter/bootstrap/dispatch lifecycle) are owned by
  `src/backend/logic/jobs/index.ts`.

## Disallowed Patterns

- Importing drizzle repo implementation files directly.
- Long-running integration logic inside API handlers instead of job workers.
- Re-implementing conditional domain branching in jobs when equivalent `core/` logic exists.
- Per-row `writeRepo` map flushes when equivalent bulk write-repo methods exist.
- Persisting per-item run metadata in per-item transactions inside loops when a single post-processing write flush is
  possible.
- Monolithic jobs that serialize independent work instead of fan-out enqueueing.

## Notes for Future Files

- Keep job payloads and state transitions represented as plain values for observability and replay safety.
- Keep worker process bootstrap in `src/backend/worker.entry.ts`; keep `src/backend/logic/jobs/` focused on runtime
  internals.
