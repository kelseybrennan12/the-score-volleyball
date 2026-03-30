# Repo Layout

## Spec Metadata

- ID: PR0005
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-03-10

## Summary

Define the allowed root files/folders and the location of non-spec documentation.

## Goals

- Keep repo structure predictable.
- Ensure tooling and automation can rely on stable paths.
- Preserve a single source of truth for root layout rules.

## Non-Goals

- Defining low-level implementation details inside each source layer.

## Requirements

### Must:

- Root contains [`README.md`](/README.md), [`AGENTS.md`](/AGENTS.md), approved config files, and top-level folders.
- Approved root files include project-governance and toolchain files as needed, for example:
  - `package.json`
  - `mise.toml`
  - lockfiles and formatter/linter configs
- Top-level folders include [`docs/`](/docs/), [`.agents/`](/.agents/), and optional tool-specific folders.
- Agent tool config files are thin redirect adapters only and do not become alternate instruction sources.
- Redirect adapter files point to [`/AGENTS.md`](/AGENTS.md) using absolute repo-root markdown links.
- Documentation roots include [`docs/README.md`](/docs/README.md), [`docs/specs/README.md`](/docs/specs/README.md), and
  [`docs/efforts/README.md`](/docs/efforts/README.md).
- Supported agent redirect adapters include:
  - [`/CLAUDE.md`](/CLAUDE.md)
  - [`/.cursorrules`](/.cursorrules)
  - [`/.windsurfrules`](/.windsurfrules)
  - [`/.github/copilot-instructions.md`](/.github/copilot-instructions.md)
- Specs live under [`/docs/specs/`](/docs/specs/).
- Effort documents live under [`/docs/efforts/`](/docs/efforts/) and follow the effort template in
  [`/docs/efforts/README.md`](/docs/efforts/README.md).
- Runtime/source layout uses a canonical `src/` tree:
  - `src/frontend/`
  - `src/backend/logic/core/`
  - `src/backend/logic/services/`
  - `src/backend/logic/jobs/`
  - `src/backend/runtime/ports/`
  - `src/backend/runtime/adapters/`
  - `src/backend/runtime/bootstrap/`
  - `src/shared/`
  - `src/tests/`
- Each canonical source folder includes a `README.md` documenting purpose, boundaries, and allowed dependencies.
- Repository data-access contract files under `src/backend/runtime/ports/` and `src/backend/runtime/adapters/repos/`
  are:
  - `read.ts`
  - `write.ts`
  - `drizzle-read.ts`
  - `drizzle-write.ts`
- Top-level `/infra/` stores deployment/runtime assets and includes:
  - `/infra/docker/`
  - `/infra/azure/`

### Frontend File Naming

- **Component files** (`.tsx` that export a React component or JSX): `PascalCase` matching the primary export — e.g.
  `DashboardPage.tsx`, `PrimarySidebarNav.tsx`, `PageSidebar.tsx`.
- **Component stylesheets** (`.scss` paired 1:1 with a component file): same `PascalCase` name as the component — e.g.
  `PageSidebar.scss` for `PageSidebar.tsx`. Imported by the component file, not globally.
- **Non-component files** (`.ts` / `.tsx` with no exported JSX — hooks, utilities, contexts, configs, data, types):
  `kebab-case` — e.g. `svg-paths.ts`, `use-auth-session.ts`, `vite.config.ts`.
- **Standalone/global stylesheets** (not paired with a specific component): `kebab-case` — e.g. `colors.scss`,
  `styles.scss`, `layout.scss`, `card.scss`.

### Should:

- Folder responsibilities are documented via folder or process docs.
- Docs link to this spec when referencing allowed root files or folder placement.
- Docs that describe agent instructions should link to
  [`/docs/specs/process/agent-skills.md`](/docs/specs/process/agent-skills.md) and avoid divergent policy wording.
- Cross-runtime shared contracts/utilities live in `src/shared/`.

### May:

- Add new approved root files or folders as requirements evolve.

## Folder Kinds

- [`/docs/specs/`](/docs/specs/): authoritative specs.
- [`/docs/efforts/`](/docs/efforts/): effort plans, execution notes, deviations, and status.
- [`/.agents/skills/`](/.agents/skills/): team-owned agent skills.
- `/src/`: canonical application source tree.
- `/infra/`: container and cloud deployment assets.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
