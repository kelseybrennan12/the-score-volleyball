# Scripts

This folder contains the helper/implementation side of the repository command surface.

## Ownership Model

- `mise` is the canonical public command surface.
- Complex public tasks live under [`/mise-tasks/`](/mise-tasks/README.md).
- Shared workflow helpers and low-level reusable build/env scripts live under `scripts/`.
- Domain README files document the public entrypoints, supported environment variables, and internal helpers.

## Current Domains

- [`/mise-tasks/README.md`](/mise-tasks/README.md)
- [`/scripts/test/README.md`](/scripts/test/README.md)

## Notes

- Local dev machine and local VM use the same underlying test/build scripts.
- GitHub Actions uses the same task/helper model and image contract; only the image build mode differs.
- Orchestration-heavy command definitions should live in `mise-tasks/`, not large inline `mise.toml` blocks.
