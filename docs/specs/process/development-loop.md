# Development Loop

## Spec Metadata

- ID: PR0007
- Type: Process
- Status: active
- Version: v1
- Last Updated: 2026-03-11

## Summary

Define the canonical spec-driven development loop used by this project.

## Goals

- Keep implementation work aligned with specs.
- Make planning and execution auditable through effort files.
- Ensure drift is detected and backported into specs and docs.

## Non-Goals

- Defining architecture/runtime behavior.
- Replacing domain-specific audits.

## Requirements

### Must:

- Development work follows this ordered loop:
  1. Skills: load relevant team skills from [`/AGENTS.md`](/AGENTS.md) for the task.
  2. Spec: update specs to describe the desired state of the world.
  3. Effort: create one effort file named `YYYY-MM-DD-HH-MM-<effort-name>.md` under [`/docs/efforts/`](/docs/efforts/)
     and freeze the spec set.
  4. Plan: derive a decision-complete implementation plan in the effort file.
  5. Execute: implement against the plan/specs and run required checks.
  6. Audit: run the `audit` skill with relevant audit types and verify implementation against specs and documented
     patterns.
  7. Backport: update specs and docs for any divergence and record deviations.
  8. Repeat.
- Every effort file includes: `Date`, `Time`, scope, frozen spec set, coverage checklist, plan, execution notes,
  deviations, and status.
- Execute work does not begin until all of the following are true:
  - The effort file exists under [`/docs/efforts/`](/docs/efforts/).
  - The effort `Plan` section is decision-complete (tasks, tests, and acceptance criteria).
  - The plan has explicit user approval recorded in the effort header fields defined in
    [`/docs/efforts/README.md`](/docs/efforts/README.md), with `Plan Approved By` set to the approver's actual human
    name rather than a placeholder, handle, or shorthand label.
- For behavior-changing structural refactors, a spec delta describing the target architecture is required before
  implementation edits begin.
- If execution is interrupted or aborted, the default next step is back to `Plan`.
- Execution resumes after an interruption only when the user explicitly confirms resume and scope has not changed.
- Deviations discovered during execution or audit are explicitly recorded in the effort file.
- `Deviations` is never left as `None` when scope, sequence, acceptance criteria, or implementation approach changed.
- Backport updates are applied before closing an effort when behavior diverges from specs.
- Behavior-changing structural refactor efforts must include a `spec-alignment` audit before closure.

### Should:

- Audits include at least spec alignment and one domain-specific audit type from project audit guidance in
  [`/docs/specs/process/audits.md`](/docs/specs/process/audits.md).
- Efforts are scoped so they can be completed and audited in a single focused pass.

### May:

- Use additional audit types when risk or scope warrants it.

## Phase Exit Criteria

- `Spec`: target behavior is documented and no unresolved MUST-level ambiguity blocks implementation.
- `Effort`: effort file exists with frozen spec set and populated coverage checklist.
- `Plan`: implementation approach is decision-complete with tests and acceptance criteria.
- `Execute`: code changes are complete and required quality checks have run.
- `Audit`: required audit types have run and findings are recorded.
- `Backport`: specs/docs are updated for divergence and deviations are recorded in the effort file.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
