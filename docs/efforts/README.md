# Efforts

Efforts capture time-boxed planning, execution notes, and deviations for a specific set of specs. They are not specs and
live outside [`/docs/specs/`](/docs/specs/).

## Naming

- Filenames use the format: `YYYY-MM-DD-HH-MM-<slug>.md`
- The datetime prefix matches the `Date` and `Time` fields in the effort header.
- Default timezone is UTC unless another timezone is explicitly documented for the project.

## Effort Template

Use this exact header and section layout for every effort file.

```markdown
# Effort

- Name: <Effort Name>
- Date: YYYY-MM-DD
- Time: HH:MM
- Plan Approved By:
- Plan Approved At:

## Scope

## Spec Set (Frozen)

## Spec Coverage Checklist

## Plan

## Execution Notes

## Deviations

## Status
```

## Link Conventions

- Use markdown link syntax (`[text](path)`) for all file path references in effort content — not backtick-only text.
- Spec set entries use the format: `[/docs/specs/…](/docs/specs/…)`.
- Plan section file references use the format: `[src/…/file.ts](/src/…/file.ts)` or with line anchors:
  `[src/…/file.ts:42](/src/…/file.ts#L42)`.
- Cross-effort references use the format: `[YYYY-MM-DD-HH-MM-slug.md](/docs/efforts/YYYY-MM-DD-HH-MM-slug.md)`.

## Expectations

- Plans are detailed enough to execute without decisions.
- Leave `Plan Approved By` and `Plan Approved At` blank until explicit approval exists.
- `Plan Approved By` must be the approver's actual human name (for example `Nicholas Keuning`), not placeholders,
  generic labels, usernames/handles, or shorthand such as `user`, `User (chat)`, `<pending>`, `nicholaskeuning`, or
  `Max`.
- If approval happens in chat, record the human name in `Plan Approved By` and put any extra context elsewhere in the
  effort body if needed.
- No implementation edits begin before `Plan Approved By` and `Plan Approved At` are set.
- Check off spec coverage checklist items and acceptance criteria as each is verified during or immediately after
  implementation.
- Never set `Status: Done` while any checklist item is unchecked (`- [ ]`).
- If a checklist item must be unchecked after having been checked (for example, implementation reverted or found
  incomplete), revert `Status` from `Done` to `In Progress`.
- Specs are updated in the backport step if reality diverges.
- `Deviations` must list concrete differences when scope, sequence, acceptance criteria, or approach changed.
- `Deviations: None` is valid only when no such changes occurred.
