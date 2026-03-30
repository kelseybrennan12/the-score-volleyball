# Stand-Up Activity

## Spec Metadata

- ID: PR0008
- Type: Process
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define the daily stand-up activity: a repeatable, agent-assisted recap that answers what changed, what remains, and
where the team is blocked.

## Goals

- Give the team a shared, scannable snapshot before or during stand-up.
- Keep stand-up outputs question-driven and easy to refine over time.

## Non-Goals

- Replacing verbal stand-up or human judgment on priorities.

## Core Concepts

- Stand-up recap: one run of this activity using repo state plus an optional date or SHA.
- Output: concise and bulleted. When generated, it overwrites `/docs/stand-up-last.md`. That artifact is ephemeral and
  does not need to stay checked into the sanitized starter baseline between runs.

## Required Sections

1. Yesterday's commits
2. Backport spec updates
3. Efforts
4. Scope
5. Spec diff
6. Spec to-do
7. Concerns

## Requirements

### Must:

- The activity fills the required sections using repo state and keeps output concise and bulleted.
- Spec diff uses the same from-SHA/date resolution as [`diff-specs`](/.agents/skills/diff-specs/SKILL.md).
- Outdated implementation is called out explicitly in the spec diff section.
- Each run overwrites `/docs/stand-up-last.md` when the artifact is generated.

### Should:

- Run at least once per workday.
- Use [`diff-specs`](/.agents/skills/diff-specs/SKILL.md) Phase 1 for spec diff and stale implementation discovery.

### May:

- Add a `mise` task that runs this activity with a default date or SHA.

## Open Questions

- None.

## Related

- [stand-up](/.agents/skills/stand-up/SKILL.md)
- [diff-specs](/.agents/skills/diff-specs/SKILL.md)
- [effort-backport](/.agents/skills/effort-backport/SKILL.md)
- [effort-new](/.agents/skills/effort-new/SKILL.md)
- [effort-plan](/.agents/skills/effort-plan/SKILL.md)
- [Development Loop](/docs/specs/process/development-loop.md)
