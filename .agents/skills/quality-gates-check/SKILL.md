---
name: quality-gates-check
description: Run and report local quality-gate checks from project process guidance (formatting and related checks).
---

# Quality Gates Check

## Use When

- User asks to run quality gates, formatting checks, or pre-merge validation.
- An effort execute or audit step needs gate verification.

## Workflow

1. Read project quality-gates spec (for example
   [`/docs/specs/process/quality-gates.md`](/docs/specs/process/quality-gates.md)).
2. Run configured local checks in repo tooling.
3. Report pass/fail with exact failing command and files.
4. If checks are deferred by spec decision (for example CI not enabled), report as deferred with evidence.

## Expected Checks

- Formatting commands from repo tooling.
- Pre-commit configuration presence and alignment.
- Any additional local checks requested by user.

## Output

```
# Quality Gates Report
- Date:
- Scope:

## Checks
- <command>: pass|fail|deferred
  - Evidence:

## Summary
- Passed:
- Failed:
- Deferred:

## Follow-up
- [ ] Fix failures:
- [ ] Re-run checks:
```
