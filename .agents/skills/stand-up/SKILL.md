---
name: stand-up
description: Run the daily stand-up activity; fill the recap template and overwrite the single stand-up artifact.
---

# Stand-Up

## Use When

- User says **"run stand up"** (or "run standup", "stand up", "standup", "generate stand-up").
- User wants the stand-up recap generated for the team.

## What to Do

1. Load [/docs/specs/process/stand-up-activity.md](/docs/specs/process/stand-up-activity.md) and follow it.
2. Fill the template (sections 1–7). Keep output **concise and bulleted**; shorten or link to
   [diff-specs](/.agents/skills/diff-specs/SKILL.md), effort files, spec paths.
   - **Yesterday's commits (1):** Commits since the recap reference date (previous workday by default). Same since-when
     as recap; run `git log` over that range, group by author, and use **sub-bullets under each author** for a short,
     readable summary of what each person did.
   - **Backport spec updates (2):** Spec/docs files updated due to
     [effort-backport](/.agents/skills/effort-backport/SKILL.md) in the period. Derive from: commits that touch
     `docs/specs/` or `docs/reference/` (etc.) with backport-related messages, or from effort files marked Done in
     period that have a "Backport" / "Backport Notes" section. For each: path(s), brief what-changed (requirement text,
     completion state, domain glossary, deviation resolved), and which effort or deviation. If none: "None."
   - **Efforts (3):** Group by **who** (name first), with each done effort as a sub-bullet (path + one-line outcome).
     Attribute who from git (e.g. `git log -1 --format='%an' -- <effort-file>` or commits in period that touched the
     effort file).
   - **Scope (4):** Scope left; distance to implementation complete; optional time-box / work split.
   - **Spec diff (5):** Group changed specs **by type** (process, product, experience, technical, reference, figma,
     etc.).
   - **Spec to-do (6):** Start with a **one-sentence intro** that explains what the section is for (e.g. open questions
     and remaining work in current scope, per spec).
   - **Concerns (7):** Only report concerns that are **still present**. If a concern is no longer valid, do not report
     it; if new concerns arise, report them. Use an antagonistic lens to avoid self-fulfilling biases. For each concern
     reported, include how many days it has been reported (e.g. day 1, day 3) by comparing with the previous stand-up
     when present. Do not report the blob-storage revert/re-add unless there is a new or different concern about blob
     storage.
3. Resolve "since when" using optional `date` or `sha` from the user, or **default to the previous working day** (e.g.
   when run on Monday, use Friday; when run on Tuesday, use Monday). Same date/sha semantics as
   [diff-specs](/.agents/skills/diff-specs/SKILL.md): use that date to resolve the newest commit before that date's ET
   midnight as the since-SHA; commits "in period" are then from that SHA through HEAD.
4. Write the result to **[/docs/stand-up-last.md](/docs/stand-up-last.md)** (overwrite the file).
5. Confirm done and point the user to `docs/stand-up-last.md`.

## Output

- Overwritten [/docs/stand-up-last.md](/docs/stand-up-last.md) with the filled template.
- Brief confirmation in chat.
