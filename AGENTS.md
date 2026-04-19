# AGENTS

## Start Here

- [README.md](/README.md)
- [docs/README.md](/docs/README.md)
- [docs/specs/README.md](/docs/specs/README.md)
- [docs/specs/process/specs-organization.md](/docs/specs/process/specs-organization.md)
- [docs/specs/process/domain-glossary.md](/docs/specs/process/domain-glossary.md) — term ↔ code/UI mapping

## Process

- [docs/specs/process/agent-skills.md](/docs/specs/process/agent-skills.md)
- [docs/specs/process/development-loop.md](/docs/specs/process/development-loop.md)
- [docs/specs/process/developer-commands.md](/docs/specs/process/developer-commands.md)
- [docs/specs/process/repo-layout.md](/docs/specs/process/repo-layout.md)
- [docs/specs/process/quality-gates.md](/docs/specs/process/quality-gates.md)
- [docs/specs/process/testing-policy.md](/docs/specs/process/testing-policy.md)
- [docs/efforts/README.md](/docs/efforts/README.md)

## Repo Surface

- Frontend: Next.js App Router under [`/src/app/`](/src/app/) with UI components in
  [`/src/components/`](/src/components/).
- Domain types + shared helpers: [`/src/shared/domain/`](/src/shared/domain/). Used by both the UI and the ingestion
  pipeline.
- Ingestion:
  - Pure core: [`/src/backend/logic/core/`](/src/backend/logic/core/) (parsers, outcome mapping, record/rank,
    roster-diff, league source list).
  - Adapters:
    [`/src/backend/runtime/adapters/integrations/google-sheets.ts`](/src/backend/runtime/adapters/integrations/google-sheets.ts)
    (XLSX fetch) and [`/src/backend/runtime/adapters/snapshots/fs.ts`](/src/backend/runtime/adapters/snapshots/fs.ts)
    (snapshot filesystem repo).
  - CLI entrypoint: [`/src/backend/ingest.entry.ts`](/src/backend/ingest.entry.ts).
- Data: [`/data/snapshots/active/`](/data/snapshots/active/) and [`/data/snapshots/archive/`](/data/snapshots/archive/),
  checked into the repo.
- Tests: [`/src/tests/unit/`](/src/tests/unit/) (Vitest) with XLSX fixtures in
  [`/src/tests/fixtures/`](/src/tests/fixtures/).

## Testing

- Full policy: [docs/specs/process/testing-policy.md](/docs/specs/process/testing-policy.md)

## Command Preference

- Prefer `mise run <task>` for execution in agent workflows.
- Key tasks:
  - `mise run dev` — start Next.js dev server.
  - `mise run build` — production build.
  - `mise run ingest [-- --dry-run] [-- --league <slug>]` — refresh snapshots from Google Sheets.
  - `mise run test` — unit tests.
  - `mise run lint` / `mise run typecheck` / `mise run fmt-check`.
- For command-surface details and task naming, follow
  [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md).

## Agent Redirect Policy

- [`/AGENTS.md`](/AGENTS.md) is the canonical instruction source for AI coding agents in this repository.
- Tool-specific config files (for example [`/CLAUDE.md`](/CLAUDE.md)) are redirect adapters only.
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
