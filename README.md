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
- `mise run deps:check` (advisory dependency drift summary)
- `mise run vm:gh:ensure` / `mise run vm:gh:shell`
- `mise run test:unit` / `mise run test:integration` / `mise run test:e2e`
- `mise run ci`

Recommended first-time setup:

1. `mise run setup`
2. `cp .env.example .env`
3. `mise run dev:up`

Runtime env loading is managed by `mise` via `mise.toml`. Application code reads validated environment config from
backend infra modules rather than loading dotenv files directly.

For a GitHub-like local Linux VM on macOS, use:

1. `mise run vm:gh:ensure`
2. `mise run vm:gh:shell`

By default this creates or reconciles one worktree-scoped VM per folder, named `starter-gh-<folder>`, and mounts the
current repository root into that VM. `vm:gh:ensure` also installs `mise` inside the guest and configures shell
activation so repo commands are ready after you enter the VM.

## Observability Topology (Local/Dev)

- `api` and `jobs` emit OTLP logs, metrics, and traces to Alloy
- Alloy routes:
  - logs to Loki
  - metrics to Prometheus
  - traces to Tempo
- Grafana reads Loki, Prometheus, and Tempo

## AI Agent Support

Project instructions live in [`/AGENTS.md`](/AGENTS.md). Agent-specific config files are redirect adapters only: they
point to [`/AGENTS.md`](/AGENTS.md) and do not duplicate project instructions.

This repo commits project-scoped Codex MCP config in [`/.codex/config.toml`](/.codex/config.toml). In a trusted project,
Codex loads that file automatically, so `mise` MCP is available without a separate per-user setup step. Restart Codex
after pulling the change if you already had a session open.

| Agent          | Config File                                                            |
| -------------- | ---------------------------------------------------------------------- |
| OpenAI Codex   | [`/AGENTS.md`](/AGENTS.md) (native)                                    |
| Claude Code    | [`/CLAUDE.md`](/CLAUDE.md)                                             |
| Cursor         | [`/.cursorrules`](/.cursorrules)                                       |
| Windsurf       | [`/.windsurfrules`](/.windsurfrules)                                   |
| GitHub Copilot | [`/.github/copilot-instructions.md`](/.github/copilot-instructions.md) |

### Adding support for a new agent

1. Find the agent's config file convention (check its docs for the expected filename and location).
2. Create that file in the repo with a single line pointing to AGENTS.md:
   ```
   See [AGENTS.md](/AGENTS.md) for project instructions, process, loop rules, and available skills.
   ```
3. Add the new entry to the table above.

All project knowledge stays in AGENTS.md and the docs it references. Agent-specific files are only redirects.

## Next Steps

- Expand starter-specific product specs when the repository grows beyond the current baseline pages.
- Keep CI, worker coverage, and deployment docs aligned with the canonical `mise` command surface.
- Optional environment setup guidance: [`/infra/azure/federation/README.md`](/infra/azure/federation/README.md)
