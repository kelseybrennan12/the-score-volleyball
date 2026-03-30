# Project Starter

This repository is the spec-driven starting point for Project Starter.

## What Is Included

- Process and operations specs under [`/docs/specs/`](/docs/specs/)
- Effort template guidance under [`/docs/efforts/`](/docs/efforts/)
- Lightweight reference docs under [`/docs/reference/`](/docs/reference/)
- New-project adaptation guide under
  [`/docs/reference/new-project-adaptation-guide.md`](/docs/reference/new-project-adaptation-guide.md)
- Agent workflow guidance in [`/AGENTS.md`](/AGENTS.md)

## Command Surface Status

Current specs define `mise` as the canonical developer and agent command entrypoint.

Implemented baseline workflows:

- `mise run setup`
- `mise run dev:up` / `mise run dev:down` / `mise run dev:down-reset`
- `mise run dev:logs` / `mise run dev:logs:follow` / `mise run dev:logs:all`
- `mise run dev:logs:web`
- `mise run dev:logs:idp`
- `mise run build`
- `mise run fmt`
- `mise run fmt-check`
- `mise run pre-commit`
- `mise run hooks-install`
- `mise run env:sync`
- `mise run deps:check`
- `mise run test:unit` / `mise run test:integration` / `mise run test:e2e`
- `mise run ci`

Recommended first-time setup:

1. `mise run setup`
2. `cp .env.example .env`
3. `mise run dev:up`

Runtime env loading is managed by `mise` via `mise.toml`. Application code reads validated environment config from
backend infra modules rather than loading dotenv files directly.

## Observability Topology (Local/Dev)

- `api` and `jobs` emit OTLP logs, metrics, and traces to Alloy
- Alloy routes:
  - logs to Loki
  - metrics to Prometheus
  - traces to Tempo
- Grafana reads Loki, Prometheus, and Tempo

## AI Agent Support

Project instructions live in [`/AGENTS.md`](/AGENTS.md). Agent-specific config files are redirect adapters only.

## Next Steps

- Expand starter-specific product specs when the repository grows beyond the current baseline pages.
- Keep CI, worker coverage, and deployment docs aligned with the canonical `mise` command surface.
- Optional environment setup guidance: [`/infra/azure/federation/README.md`](/infra/azure/federation/README.md)
