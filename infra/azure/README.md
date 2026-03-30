# Azure Infra

Infrastructure-as-code for deploying Project Starter on Azure Container Apps.

## Runtime Topology

- `project-starter-edge`: public ingress app (Caddy + static frontend + reverse proxy)
- `project-starter-api`: internal ingress app (tRPC/auth API; runtime-only startup)
- `project-starter-jobs`: internal worker app
- `project-starter-db-bootstrap`: manual Container Apps job that runs checked-in schema migrations before runtime
  rollout

Both runtime images are built from `infra/docker/Dockerfile`:

- `project-starter-app:<tag>` (shared by bootstrap job, API, and jobs)
- `project-starter-edge:<tag>` (edge proxy + static frontend)

## Entrypoints

- Full environment reconciliation: `infra/azure/main.bicep`
- Runtime-only promotion for normal releases: `infra/azure/runtime.bicep`
- First-deploy secret bootstrap: `infra/azure/bootstrap.bicep`
- Validation workflow: `.github/workflows/ci.yml`
- Optional manual Azure rollout: `.github/workflows/cd.yml` (`workflow_dispatch` only)

## Deployment Shape

- `main.bicep` provisions or repairs shared environment resources such as the managed environment, identity, storage,
  PostgreSQL, and observability stack.
- `runtime.bicep` binds to those existing shared resources and updates only the bootstrap job and application Container
  Apps for normal commit-SHA promotions.
- The Azure pack is intentionally optional for the starter. Local Docker and checked-in runtime defaults remain the
  primary happy path.
- CD updates the bootstrap job to the target `project-starter-app:<tag>`, runs it, then deploys API, jobs, and edge on
  the runtime path before waiting for the target API/jobs revisions.
