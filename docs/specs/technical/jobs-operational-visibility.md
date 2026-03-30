# Jobs Operational Visibility

## Spec Metadata

- ID: T0020
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define the canonical jobs-runtime visibility contract across observability dashboards and the app-owned job run-state
read model.

## Goals

- Provide fast, reliable visibility into jobs throughput, failures, backlog, and lag.
- Standardize jobs lifecycle telemetry fields for queryability and cross-runtime correlation.
- Provide authoritative per-job status and lineage visibility for admin workflows.

## Non-Goals

- Building in-app jobs operational mutation controls.
- Replacing Grafana, Loki, Prometheus, or Tempo with an app-native observability stack.
- Defining alert routing policy.

## Requirements

### Must:

- Jobs runtime emits counters:
  - `starter_jobs_claimed`
  - `starter_jobs_processed`
  - `starter_jobs_failed`
- Jobs runtime emits histograms:
  - `starter_jobs_duration_ms`
  - `starter_jobs_queue_wait_ms`
- Jobs lifecycle telemetry includes:
  - `event`
  - `job_id`
  - `job_type`
  - `backend_job_id`
  - `correlation_id`
  - `job_run_id`
  - `parent_job_run_id`
  - `root_job_run_id`
  - `batch_id`
  - `trace_id`
  - `span_id`
  - `attempts`
  - `max_attempts`
  - `outcome`
  - `duration_ms` on terminal outcomes
  - `queue_wait_ms` on claim
  - `error_code` on failures
- Baseline top-level dashboards include:
  - `starter-api-health`
  - `starter-jobs-fleet-ops`
  - `starter-data-plane-health`
- Deployment/run visibility distinguishes bootstrap failures from normal worker runtime failures.
- Jobs enqueue flow writes app-owned `job_runs` shadow rows and propagates lineage metadata through the worker payload.
- Jobs worker extracts carried trace context before processing so parent/child runs are linked in distributed traces.
- Jobs worker lifecycle updates shadow run state on claim and settle:
  - `pending -> processing` on claim
  - `processing -> completed|failed` on settle
- Job handlers evaluate branching logic through pure `core/` decision functions and flush decision outputs
  unconditionally.
- Retryable integration failures are not swallowed as successful jobs.
- Failed settlement persists stable error references when rich error payload storage is written.
- Admin API exposes run summaries and nested run detail from `job_runs`.
- Admin UI includes a read-only nested run tree as the authoritative per-job state surface.
- `starter-jobs-fleet-ops` includes panels for:
  - lifecycle claim/settle/failure rates
  - failure ratio
  - failure rates by `job_type`
  - recent failure logs for pivoting to run-tree and blob references

### Should:

- Failure telemetry remains low-cardinality by using stable `error_code` values.
- Queue-wait and claim/settle panels support per-job-type drilldown and fleet-level totals.
- Dashboard-first troubleshooting remains the default for fleet-level diagnostics.
- Per-job current-state troubleshooting defaults to the app-admin run tree instead of derived dashboard math.

### May:

- Add SLO-oriented panels and alert thresholds later.
- Add a read-only in-app jobs snapshot page beyond the current starter surface.

## Related

- [`/docs/specs/operations/observability.md`](/docs/specs/operations/observability.md)
- [`/docs/specs/technical/platform-architecture.md`](/docs/specs/technical/platform-architecture.md)

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
