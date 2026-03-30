---
name: effort-backport
description: Backport implementation reality into specs and docs, recording deviations and updating completion states.
---

# Effort Backport

## Use When

- Execution or audit reveals divergence from specs.
- An effort is being closed and spec/docs need alignment.

## Workflow

1. Read effort execution notes, deviations, and audits.
2. Compare actual behavior against frozen specs.
3. Update affected specs/docs:

- requirements text
- completion status and remaining gaps
- links/paths if moved
- domain glossary ([`docs/specs/process/domain-glossary.md`](/docs/specs/process/domain-glossary.md)): add or update
  entries for any new domain concepts, record types, UI labels, or term clarifications that emerged during execution

4. Update effort:

- checklist statuses
- deviations (resolved or open)
- status: set to `Done` only if every checklist item is marked `[x]`; otherwise set (or keep) as `In Progress`

5. Keep updates minimal and traceable to observed behavior.

## Output

- List of updated files.
- Mapping from each change to requirement/deviation.
- Remaining gaps, if any.
