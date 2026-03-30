# AGENTS

## Start Here

- [README.md](/README.md)
- [docs/README.md](/docs/README.md)
- [docs/specs/README.md](/docs/specs/README.md)
- [docs/specs/process/specs-organization.md](/docs/specs/process/specs-organization.md)
- [docs/figma/README.md](/docs/figma/README.md) — Starter Figma/design guidance and page implementation checklist
- [docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md) — Starter term ↔ code/UI mapping

## Process

- [docs/specs/process/agent-skills.md](/docs/specs/process/agent-skills.md)
- [docs/specs/process/development-loop.md](/docs/specs/process/development-loop.md)
- [docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)
- [docs/specs/process/repo-layout.md](/docs/specs/process/repo-layout.md)
- [docs/specs/process/quality-gates.md](/docs/specs/process/quality-gates.md)
- [docs/specs/process/testing-policy.md](/docs/specs/process/testing-policy.md)
- [docs/efforts/README.md](/docs/efforts/README.md)

## File-Type Approach Index

- Backend core decisions: [`/src/backend/logic/core/README.md`](/src/backend/logic/core/README.md)
  - Pure logic only. No repository writes, network calls, or framework/runtime IO.
- Backend services: [`/src/backend/logic/services/README.md`](/src/backend/logic/services/README.md)
  - Orchestration layer (`read -> core -> write`). No direct integration-adapter calls.
- Backend jobs/handlers: [`/src/backend/logic/jobs/README.md`](/src/backend/logic/jobs/README.md)
  - Handler shell pattern (`read -> core -> write`), flush decision outputs, explicit transaction boundaries.
- Runtime contracts: [`/src/backend/runtime/ports/README.md`](/src/backend/runtime/ports/README.md)
  - Interface/type contracts only (`read.ts`, `write.ts`), no adapter implementation details.
- Runtime adapters: [`/src/backend/runtime/adapters/README.md`](/src/backend/runtime/adapters/README.md)
  - Concrete infrastructure and repository implementations behind ports.
- External integrations:
  [`/src/backend/runtime/adapters/integrations/README.md`](/src/backend/runtime/adapters/integrations/README.md)
  - Typed adapter boundary around third-party systems and external data sources.
- Frontend feature/runtime baseline: [`/src/frontend/README.md`](/src/frontend/README.md)
  - UI, routing, and client data concerns only; avoid backend-domain orchestration logic in UI components.
- Starter runtime architecture:
  [`/docs/specs/technical/platform-architecture.md`](/docs/specs/technical/platform-architecture.md)
  - Read before broad runtime or layering changes; it defines the retained boundaries for services, jobs, ports, and
    adapters.

## Testing

- Full policy: [docs/specs/process/testing-policy.md](/docs/specs/process/testing-policy.md)

## Command Preference

- Prefer `mise run <task>` for execution in agent workflows.
- When a suitable `mise` task exists, use it instead of invoking raw underlying CLI chains directly.
- In Codex sessions for this repo, MCP server `starter_mise` is available via
- [`/.codex/config.toml`](/.codex/config.toml). Agents MUST load `mise://tools` when the `starter_mise` MCP server is
  available.
- When `starter_mise` is available, agents MUST prefer the available `mise` tool set for development tasks when
  possible, including inspecting `mise` tasks/config/env and executing defined `mise` tasks.
- Use direct shell commands for non-`mise` workflows or when raw shell interaction is specifically needed.
- For command-surface details and task naming, follow
  [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md).

## Agent Redirect Policy

- [`/AGENTS.md`](/AGENTS.md) is the canonical instruction source for AI coding agents in this repository.
- Tool-specific config files (for example [`/CLAUDE.md`](/CLAUDE.md), [`/.cursorrules`](/.cursorrules),
  [`/.windsurfrules`](/.windsurfrules), and [`/.github/copilot-instructions.md`](/.github/copilot-instructions.md)) are
  redirect adapters only.
- Normative rules live in [`/docs/specs/process/agent-skills.md`](/docs/specs/process/agent-skills.md) and
  [`/docs/specs/process/repo-layout.md`](/docs/specs/process/repo-layout.md).

## Loop Rules

- Treat behavior-changing, high-risk, or ambiguous work as loop-driven.
- For loop-driven work, run `effort-plan` before implementation edits.
- Request explicit in-chat approval before implementation edits on loop-driven work.
- Check off each checklist item immediately after implementation satisfies it.

## Team Skills

- `audit`: [`.agents/skills/audit/SKILL.md`](/.agents/skills/audit/SKILL.md)
- `effort-new`: [`.agents/skills/effort-new/SKILL.md`](/.agents/skills/effort-new/SKILL.md)
- `effort-plan`: [`.agents/skills/effort-plan/SKILL.md`](/.agents/skills/effort-plan/SKILL.md)
- `effort-backport`: [`.agents/skills/effort-backport/SKILL.md`](/.agents/skills/effort-backport/SKILL.md)
- `quality-gates-check`: [`.agents/skills/quality-gates-check/SKILL.md`](/.agents/skills/quality-gates-check/SKILL.md)
- `ingest-transcript`: [`.agents/skills/ingest-transcript/SKILL.md`](/.agents/skills/ingest-transcript/SKILL.md)
- `diff-specs`: [`.agents/skills/diff-specs/SKILL.md`](/.agents/skills/diff-specs/SKILL.md)
- `stand-up`: [`.agents/skills/stand-up/SKILL.md`](/.agents/skills/stand-up/SKILL.md)
- `remaining-items`: [`.agents/skills/remaining-items/SKILL.md`](/.agents/skills/remaining-items/SKILL.md)
