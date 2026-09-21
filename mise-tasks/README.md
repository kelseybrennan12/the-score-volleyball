# Mise Tasks

This folder owns the repository's orchestration-heavy command surface.

## Model

- `mise` is the canonical public entrypoint.
- Multi-step workflows live here as executable file tasks with `#MISE` header comments for description and tools.
- [`/mise.toml`](/mise.toml) stays focused on tools, env config, and small inline tasks.
- Shared implementation helpers live under [`/scripts/`](/scripts/).
- The full task catalog is in [`/docs/specs/process/developer-commands.md`](/docs/specs/process/developer-commands.md).

## Current File Tasks

- `pre-commit` — run the format check (staged files only under the git hook), lint, and typecheck in parallel. Installed
  as the git pre-commit hook by `mise run hooks-install`.
- `ci` — run every GitHub Actions gate locally, sequentially and in the same order as CI (format check, lint, typecheck,
  tests, build).

Every other task is a one-liner or thin `usage` wrapper in [`/mise.toml`](/mise.toml).

## Notes

- File tasks use native `mise` task env such as `MISE_PROJECT_ROOT`.
- A subdirectory maps to a task-name prefix: a file at `mise-tasks/gh/runs` would be `mise run gh:runs`. None exist
  today; grouped names like `gh:*` and `deps:*` are inline TOML tasks.
- Prefer direct file tasks over extra private wrappers when the task body is short and readable.
