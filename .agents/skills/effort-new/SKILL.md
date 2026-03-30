---
name: effort-new
description: Create a new effort file from the project template and freeze the relevant spec set for planned work.
---

# Effort New

## Use When

- User asks to start new work that should follow the development loop.
- A task needs a formal effort before planning and execution.

## Workflow

1. Determine effort slug from the request.
2. Run `date -u +"%Y-%m-%d %H:%M"` to get the current UTC date and time.
3. Create file: `/docs/efforts/YYYY-MM-DD-HH-MM-<slug>.md` using the values from step 2.
4. Use `/docs/efforts/README.md` sections and structure.
5. Fill:

- Name
- Date
- Time
- Leave `Plan Approved By` and `Plan Approved At` blank until explicit approval exists.
- Scope
- Spec Set (Frozen)
- Spec Coverage Checklist
- Initial Plan
- Status = `In Progress`

Never prefill approval metadata with placeholders or generic labels such as `user`, `owner`, `<pending>`, usernames, or
shorthand. When approval is later granted, record the approver's actual human name.

6. Record any known upfront deviations.

## Output

- Return created file path.
- List frozen specs.
- List open checklist items.
- **STOP. Do not proceed to planning, editing, or implementing.** Wait for explicit user instruction before the next
  step.
