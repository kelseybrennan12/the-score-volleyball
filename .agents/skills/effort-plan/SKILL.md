---
name: effort-plan
description:
  Convert a frozen effort scope into a decision-complete implementation plan with acceptance criteria and tests.
---

# Effort Plan

## Use When

- User asks to plan an effort in detail before implementation.
- The effort exists but its plan is incomplete or ambiguous.

## Workflow

1. Read the effort file and frozen spec set.
2. Extract MUST/SHOULD requirements that affect implementation.
3. Build a decision-complete plan:

- approach
- interfaces/files touched
- edge cases
- test strategy
- acceptance criteria

4. Update the effort plan section and coverage checklist.
5. Keep execution concerns out of the plan until approved by user.

Keep `Plan Approved By` and `Plan Approved At` blank until explicit approval exists. When approval is later recorded,
use the approver's actual human name in `Plan Approved By`, not a placeholder, handle, or shorthand label.

## Output

- Updated plan section in effort file.
- Explicit assumptions/defaults chosen.
- Acceptance criteria checklist.
- **STOP. Do not implement.** Plan approval is not implementation approval. Wait for a separate explicit instruction to
  begin execution.
