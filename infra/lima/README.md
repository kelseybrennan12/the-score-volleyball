# Lima

Checked-in Lima configuration for the repository's GitHub-like local VM workflow.

## Canonical Tasks

- `mise run vm:gh:ensure`
- `mise run vm:gh:shell`

## Contract

- `vm:gh:ensure` is idempotent:
  - defaults to one worktree-scoped VM per folder, named `starter-gh-<folder>`
  - creates the VM if it does not exist
  - reconciles an existing same-name VM to the current repo mount and configured CPU/memory/disk/mount settings
  - starts the reconciled VM
  - installs `mise` inside the guest if needed and configures guest shell activation
  - does not silently delete and recreate existing Lima instances
- VM defaults may be overridden with env vars:
  - `STARTER_GH_VM_NAME`
  - `STARTER_GH_VM_MOUNT`
  - `STARTER_GH_VM_CPUS`
  - `STARTER_GH_VM_MEMORY_GIB`
  - `STARTER_GH_VM_DISK_GIB`
  - `STARTER_GH_VM_TYPE`
  - `STARTER_GH_VM_MOUNT_TYPE`
  - `STARTER_GH_VM_ROSETTA`

## Notes

- The checked-in template focuses on Ubuntu plus rootless Docker.
- The task injects machine-specific settings such as the mounted repo path and host VM defaults.
- The default mount is the current `MISE_PROJECT_ROOT`, so each worktree gets its own matching default VM identity and
  mount target.
- `vm:gh:shell` opens in the mounted repo path inside the guest rather than `$HOME`.
