# Test Scripts

Implements the shared shell helper layer for the canonical `mise`-owned test and e2e tasks.

## Public Entry Points

Primary command surface:

- [`/mise-tasks/README.md`](/mise-tasks/README.md)
  - `mise run test:unit`
  - `mise run -- test:integration -- <vitest args...>`
  - `mise run -- test:e2e -- <playwright args...>`

## Internal Helpers

- [`/scripts/test/common.sh`](/scripts/test/common.sh)

## Shared Model

- file tasks own lane behavior directly; `scripts/test/` only holds shared shell helpers
- lane tasks consume resolved image refs; they do not decide candidate-vs-local image policy
- lane tasks use the same compose harness file and project reset behavior
- e2e readiness is owned by compose healthchecks, not a separate wait script
- lane tasks default to lane-specific compose project names (`-unit`, `-integration`, `-e2e`) while sharing one image
  tag scope per worktree unless explicitly overridden

## Environment

The test and e2e file tasks use the helpers in [`/scripts/test/common.sh`](/scripts/test/common.sh) to resolve:

Common inputs:

- `TEST_COMPOSE_PROJECT_NAME`
- `TEST_IMAGE_TAG_SCOPE`
- `TEST_APP_IMAGE`
- `TEST_EDGE_IMAGE`
- `TEST_RUNNER_IMAGE`
- `TEST_PLAYWRIGHT_IMAGE`
- `TEST_WORKERS`

Lane-specific inputs:

- integration: `INTEGRATION_VITEST_ARGS`
- e2e: `PLAYWRIGHT_ARGS`
