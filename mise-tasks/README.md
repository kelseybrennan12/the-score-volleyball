# Mise Tasks

This folder owns the repository's orchestration-heavy command surface.

## Model

- `mise` is the canonical public entrypoint.
- Complex workflows live here as file tasks.
- [`/mise.toml`](/mise.toml) stays focused on tools, env config, and small inline tasks.
- Shared implementation helpers remain under [`/scripts/`](/scripts/README.md).

## Current Groups

- `dev:*` — local runtime lifecycle commands
- `env:*` — environment sync helpers
- `deps:*` — dependency inspection and update workflows
- `deps:install` is the canonical lockfile install step for tasks that require `node_modules`
- `test:*` — canonical containerized unit, integration, and e2e flows
- `ci`, `ci:check` — local CI checks
- `pre-commit`, `setup` — top-level developer workflow tasks

## Notes

- File tasks use native `mise` task env such as `MISE_PROJECT_ROOT`.
- Grouped directories map directly to task names like `test:image:prepare`.
- Prefer direct file tasks over extra private wrappers when the task body is short and readable.
