# Observability

## Spec Metadata

- ID: T0015
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define runtime logging and telemetry requirements for safe operation and debugging.

## Goals

- Keep runtime logging 12-factor compliant with structured events to stdout/stderr.
- Provide queryable observability data for operators and agents.
- Provide enough context to debug request, async work, and deployment flows.

## Non-Goals

- In-app log storage/query as the primary operational log system.
- Real-time alerting pipelines.

## Core Concepts

- Request log: structured log per inbound request.
- Job log: structured log per background job.
- Runtime event stream: structured JSON logs emitted to process stdout/stderr.
- Runtime metrics stream: OTel metrics emitted by runtime roles.
- Runtime traces stream: OTel spans emitted by runtime roles.
- Collector pipeline: Alloy receives OTLP telemetry and forwards to observability backends.
- Query backend: external system used to search and correlate logs by time and identifiers.

## Requirements

### Must:

- Emit structured JSON logs to stdout/stderr for all runtime roles.
- Emit structured logs for requests including method, path, status, latency, `request_id`, and `correlation_id`.
- Emit structured logs for background jobs including lifecycle outcomes and execution duration.
- Emit structured logs for bootstrap executions including `event`, `error_code`, target image tag, migration head, and
  terminal outcome.
- Apply telemetry guards such as payload truncation and sensitive-field redaction before export.
- Log errors with stable error-code strings.
- Propagate correlation IDs across frontend -> request -> async job boundaries.
- Propagate W3C trace context across async queue boundaries.
- Ship runtime logs to an external observability backend via a collector process.
- Runtime services emit OTLP logs, metrics, and traces to Alloy in local development.
- Alloy routes logs to Loki, metrics to Prometheus, and traces to Tempo in local development.
- Persist local observability state across routine runtime restarts for Grafana, Loki, Prometheus, and Tempo.
- Provision baseline Grafana dashboards from repo-managed config.
- Keep dashboard log queries aligned with emitted label schema.
- Keep dashboard metrics queries aligned with emitted metric names.
- Top-level dashboard set includes:
  - `starter-api-health`
  - `starter-jobs-fleet-ops`
  - `starter-data-plane-health`
- Jobs fleet-ops dashboard queries include:
  - jobs claimed/processed/failed rates
  - claimed vs settled rate comparison
  - jobs failure ratio
  - queue wait percentile trends (`starter_jobs_queue_wait_ms`)
  - jobs duration percentile trends
- App-admin job run tree views may be used as the canonical per-job status surface, while Grafana remains canonical for
  aggregate trend analysis.

### Should:

- Prefer dashboard-first diagnostics over ad hoc raw log-query URLs for common workflows.
- Use a hybrid dashboard model when both logs and metrics are available: Prometheus for trends and Loki for event
  drill-down.
- Runtime container-log scraping remains opt-in for local debugging and does not replace OTLP application logs as the
  canonical path.

### May:

- Add alert routing and SLO dashboards later.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Add alert-routing and SLO-focused views as follow-on work.
