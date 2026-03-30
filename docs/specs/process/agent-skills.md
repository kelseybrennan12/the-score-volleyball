# Agent Skills

## Spec Metadata

- ID: PR0006
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-02-24

## Summary

Define how team-owned Codex skills support the development loop and how they are organized, discovered, and maintained.

## Goals

- Make the spec -> effort -> plan -> execute -> audit -> backport loop easier to run consistently.
- Improve team discovery and adoption of reusable agent workflows.
- Keep skill guidance centralized and aligned with process specs.

## Non-Goals

- Defining every optional or personal skill.
- Replacing specs as the source of truth for product or technical behavior.

## Requirements

### Must:

- Team-owned skills live under [`/.agents/skills/`](/.agents/skills/) with one folder per skill.
- Each team skill folder contains a `SKILL.md` with clear trigger guidance.
- [`/AGENTS.md`](/AGENTS.md) is the canonical instruction source for AI coding agents in this repository.
- [`/AGENTS.md`](/AGENTS.md) lists available team skills with name, description, and file path.
- Agent-specific config files (for example [`/CLAUDE.md`](/CLAUDE.md), [`/.cursorrules`](/.cursorrules),
  [`/.windsurfrules`](/.windsurfrules), and [`.github/copilot-instructions.md`](/.github/copilot-instructions.md)) are
  redirect adapters only: they point to [`/AGENTS.md`](/AGENTS.md) and do not duplicate project instructions.
- Redirect adapters use absolute repo-root markdown links (for example [`/AGENTS.md`](/AGENTS.md)) per
  [`/docs/specs/process/specs-organization.md`](/docs/specs/process/specs-organization.md).
- Team skills that coordinate process steps align with
  [`/docs/specs/process/development-loop.md`](/docs/specs/process/development-loop.md).
- Skills that support the development loop are defined and maintained:
  - `audit`
  - `effort-new`
  - `effort-plan`
  - `effort-backport`
  - `quality-gates-check`
  - `stand-up`
  - `remaining-items`
- Before planning or implementing changes in `src/`, agents load and follow the nearest canonical folder `README.md`
  boundary docs for the file kinds they will touch (for example core/services/jobs/ports/adapters/frontend).
- [`/AGENTS.md`](/AGENTS.md) includes a file-type approach index linking those canonical folder boundary docs so
  implementation approach is available at hand during planning and execution.
- For loop-driven work, `effort-plan` is used before implementation edits begin.
- Effort closure uses `audit` and `effort-backport` to verify and record alignment.
- Skill guidance links to canonical docs/specs instead of duplicating process rules.
- `audit` is a general skill that runs typed audits instead of using one skill per audit type.

### Should:

- Skill names use lowercase hyphen-case.
- Skill workflows produce deterministic output formats where possible.
- Skill descriptions are specific enough to trigger reliably from user intent.
- Agent-specific redirect adapters should stay single-purpose and minimal (prefer one-line redirects where supported).
- [`/README.md`](/README.md) should list supported agent config files and the redirect pattern for adding new agents.
- Users explicitly invoke loop skills in sequence for predictable adoption:
  - `effort-new`
  - `effort-plan`
  - implementation
  - `audit <type>`
  - `effort-backport`

### May:

- Add domain-specific skills as the system grows.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
