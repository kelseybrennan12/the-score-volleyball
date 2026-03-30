#!/usr/bin/env bash
# Lint check: enforce frontend/runtime boundaries in feature modules.
# Exits 0 if clean, 1 if violations found.
set -euo pipefail

FRONTEND_DIR="src/frontend/features"
fail=0

# Check 1: no backend module imports from frontend feature code
echo "Checking for backend imports in ${FRONTEND_DIR}..."
backend_hits=$(grep -rnE "from ['\"](backend/|src/backend/)" "${FRONTEND_DIR}" --include='*.ts' --include='*.tsx' || true)
if [ -n "${backend_hits}" ]; then
  echo "VIOLATION: backend imports found in frontend features:"
  echo "${backend_hits}"
  fail=1
fi

# Check 2: no raw fetch calls in frontend features
echo "Checking for raw fetch calls in ${FRONTEND_DIR}..."
fetch_hits=$(grep -rn 'fetch(' "${FRONTEND_DIR}" --include='*.ts' --include='*.tsx' || true)
if [ -n "${fetch_hits}" ]; then
  echo "VIOLATION: raw fetch calls found in frontend features:"
  echo "${fetch_hits}"
  fail=1
fi

if [ "${fail}" -eq 0 ]; then
  echo "Data boundary checks passed."
fi

exit "${fail}"
