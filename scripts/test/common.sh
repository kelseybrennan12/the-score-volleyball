#!/bin/sh

set -eu

REPO_ROOT="${MISE_PROJECT_ROOT:-$(pwd)}"
TEST_COMPOSE_FILE="${REPO_ROOT}/infra/docker/docker-compose.yml"

resolve_test_project_basename() {
  worktree_name="$(basename "${REPO_ROOT}")"
  sanitized_name="$(printf '%s' "${worktree_name}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g; s/-\{2,\}/-/g; s/^-\+//; s/-\+$//')"

  if [ -z "${sanitized_name}" ]; then
    sanitized_name="test"
  fi

  printf 'project-starter-%s\n' "${sanitized_name}"
}

configure_test_lane() {
  lane_name="$1"
  base_project="${TEST_IMAGE_TAG_SCOPE:-}"

  if [ -z "${base_project}" ]; then
    if [ -n "${TEST_COMPOSE_PROJECT_NAME:-}" ]; then
      base_project="${TEST_COMPOSE_PROJECT_NAME}"
    else
      base_project="$(resolve_test_project_basename)"
    fi
  fi

  export TEST_IMAGE_TAG_SCOPE="${TEST_IMAGE_TAG_SCOPE:-${base_project}}"
  export TEST_COMPOSE_PROJECT_NAME="${TEST_COMPOSE_PROJECT_NAME:-${base_project}-${lane_name}}"
}

export_test_env() {
  project_name="${TEST_COMPOSE_PROJECT_NAME:-$(resolve_test_project_basename)}"
  image_tag_scope="${TEST_IMAGE_TAG_SCOPE:-${project_name}}"

  export TEST_COMPOSE_PROJECT_NAME="${project_name}"
  export TEST_IMAGE_TAG_SCOPE="${image_tag_scope}"
  export TEST_APP_IMAGE="${TEST_APP_IMAGE:-project-starter-app-local:${image_tag_scope}}"
  export TEST_EDGE_IMAGE="${TEST_EDGE_IMAGE:-project-starter-edge-local:${image_tag_scope}}"
  export TEST_RUNNER_IMAGE="${TEST_RUNNER_IMAGE:-project-starter-test-runner-local:${image_tag_scope}}"
  export TEST_PLAYWRIGHT_IMAGE="${TEST_PLAYWRIGHT_IMAGE:-project-starter-playwright-runner-local:${image_tag_scope}}"

  # Local test harness constants
  export TEST_BASE_APP_DB_SCHEMA="${TEST_BASE_APP_DB_SCHEMA:-public}"
  export TEST_APP_STARTUP_SEED_PACK="${TEST_APP_STARTUP_SEED_PACK:-none}"
  export TEST_JOBS_GRAPHILE_SCHEMA="${TEST_JOBS_GRAPHILE_SCHEMA:-graphile_worker_test}"
  export JOBS_POLL_INTERVAL_MS="${JOBS_POLL_INTERVAL_MS:-5000}"
  export JOBS_CONCURRENCY="${JOBS_CONCURRENCY:-40}"
  export E2E_BASE_APP_DB_SCHEMA="${E2E_BASE_APP_DB_SCHEMA:-public}"
  export E2E_APP_STARTUP_SEED_PACK="${E2E_APP_STARTUP_SEED_PACK:-none}"
  export E2E_JOBS_GRAPHILE_SCHEMA="${E2E_JOBS_GRAPHILE_SCHEMA:-graphile_worker_e2e}"
  export E2E_AUTH_SESSION_COOKIE_NAME="${E2E_AUTH_SESSION_COOKIE_NAME:-project-starter-session-e2e}"
}

test_compose() {
  AZURITE_BLOB_PORT= AZURITE_QUEUE_PORT= AZURITE_TABLE_PORT= \
    docker compose -f "${TEST_COMPOSE_FILE}" -p "${TEST_COMPOSE_PROJECT_NAME}" "$@"
}

reset_test_project() {
  test_compose down --remove-orphans --volumes --timeout 1 >/dev/null 2>&1 || true
  test_compose rm -sf >/dev/null 2>&1 || true

  container_ids="$(docker ps -aq --filter "label=com.docker.compose.project=${TEST_COMPOSE_PROJECT_NAME}" || true)"
  if [ -n "${container_ids}" ]; then
    docker rm -f ${container_ids} >/dev/null 2>&1 || true
  fi

  docker network rm "${TEST_COMPOSE_PROJECT_NAME}_default" >/dev/null 2>&1 || true
  docker volume rm "${TEST_COMPOSE_PROJECT_NAME}_test_postgres_data" >/dev/null 2>&1 || true
  docker volume rm "${TEST_COMPOSE_PROJECT_NAME}_azurite_data" >/dev/null 2>&1 || true
}

collect_e2e_runtime_logs() {
  runtime_logs_dir="${REPO_ROOT}/artifacts/e2e/runtime-logs"
  mkdir -p "${runtime_logs_dir}"
  test_compose ps > "${runtime_logs_dir}/compose-ps.txt" 2>&1 || true
  test_compose logs --no-color > "${runtime_logs_dir}/compose-logs.txt" 2>&1 || true
}
