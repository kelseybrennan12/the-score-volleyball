# Repos (Repository Adapters)

## Purpose

Concrete database read/write implementations behind runtime port contracts.

## Rules

- Frontend-facing read queries backing the starter routers (`trpc.db.*`, `trpc.session.*`, `trpc.jobs.*`) MUST stay
  behind read-repo methods rather than reaching around the repository boundary.
- Write repos target only the retained starter persistence surface: auth/session records, users, and job enqueue state.
- Keep router names and transport concerns out of repo implementations; repos expose data contracts, not HTTP semantics.
