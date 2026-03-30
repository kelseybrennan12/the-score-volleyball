# Source Tree

## Purpose

Canonical application source layout for Project Starter.

## Allowed Files

- Folder-level overview docs for source areas.
- Cross-cutting architectural notes for source boundaries.

## Rules

- Code is organized under `frontend`, `backend`, `shared`, and `tests`.
- Backend layers follow strict boundaries documented in each subfolder README.
- Every source folder in this tree keeps a local `README.md` with allowed file kinds and constraints.

## Disallowed Patterns

- Adding source code outside canonical source folders without a spec update.
- Moving deployment assets into `src/` (deployment stays under top-level `/infra/`).

## Notes for Future Files

- Prefer feature-oriented grouping within each boundary folder while preserving layer rules.
