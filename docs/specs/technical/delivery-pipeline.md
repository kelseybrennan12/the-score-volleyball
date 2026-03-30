# Delivery Pipeline

## Spec Metadata

- ID: T0017
- Type: Technical
- Status: active
- Version: v2
- Last Updated: 2026-04-06

## Summary

Define the baseline CI and optional deployment flow for the starter repository.

## Goals

- Keep CI and deployment automation centralized in GitHub Actions.
- Produce deterministic container artifacts for the shared application runtime and edge service.
- Keep provider-specific deployment details behind an optional boundary.

## Non-Goals

- Defining advanced release strategies.
- Requiring automatic promotion for every environment.

## Core Concepts

- CI workflow: verifies code quality and buildability on pull requests and protected branches.
- Deploy workflow: optionally rolls validated images to a target runtime environment.
- Artifact contract: immutable image tags tied to commit SHA.
- Registry contract: a container registry stores deployable runtime images.
- Bootstrap contract: schema/bootstrap work runs explicitly before runtime promotion.

## Requirements

### Must:

- GitHub Actions is the default executor for CI and optional deployment workflows.
- CI runs on pull requests and on pushes to `main`.
- CI installs Node dependencies through the canonical command surface with `mise run deps:install`.
- CI executes the canonical command-surface checks through `mise` tasks:
  - `mise run ci:check`
  - `mise run test-integration`
- CI executes baseline Chromium smoke coverage through `mise run e2e:smoke:container`.
- CI may split checks across multiple GitHub Actions jobs as long as the named `mise` task contract remains the source
  of truth.
- CI builds deployable application and edge container images.
- Built images are tagged with the source commit SHA.
- When a deployment workflow is enabled, it uses provider OIDC federation rather than long-lived cloud credentials in
  repo secrets.
- Deployment rollout does not rely on implicit schema mutation inside API or worker startup.
- Deployment runs the checked-in bootstrap command or job before API and jobs rollout.
- Deployed bootstrap wiring sets `APP_STARTUP_SEED_PACK=none`.
- Deployed runtime command roles are explicit:
  - bootstrap runs `app:bootstrap`
  - API startup runs `api`
  - jobs startup runs `worker`
- Manual deployment inputs may expose a non-production database reset mode, but destructive reset stays opt-in and
  human-triggered.
- Deployment serialization is environment-scoped so overlapping deploys do not race.
- Runtime promotion is gated on successful bootstrap completion.

### Should:

- CI blocks merge when required checks fail.
- Dependency-currency checks remain advisory until explicit blocking policy is defined.
- Deployment jobs are environment-scoped so higher-risk targets remain explicitly protected.
- Deployment metadata includes commit SHA, image tags, and target environment for auditability.

### May:

- Add staged environment promotion workflows in a follow-up spec.
- Add security and SBOM attestation jobs in CI once baseline runtime scaffolding is complete.
- Keep provider-specific deployment examples in-repo as optional reference implementations.

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Keep CI and deployment workflows aligned with the canonical `mise` task surface as the starter evolves.
