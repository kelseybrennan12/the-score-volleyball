---
name: diff-specs
description:
  Review spec changes since a given commit or date, walk through per-file acceptance or edits, then identify stale
  implementation work and create effort files for each cluster of misaligned code.
---

# Diff Specs

## Use When

- Developer runs a daily standup review and wants to know what changed in specs since the previous session.
- User wants to surface implementation work that may be out of date with recent spec changes.

## Inputs

- `sha`: optional. A full or abbreviated commit SHA to diff from.
- `date`: optional. A calendar date in `YYYY-MM-DD` format (Eastern time). Resolves to the newest commit that occurred
  **before** the start of that date (i.e., before ET midnight on that date).
- Provide at most one of `sha` or `date`. If neither is provided, default to yesterday's date in Eastern time.

## Date Resolution

When a `date` is used (explicit or default):

1. Determine the ET midnight boundary at the start of that date (`UTC-5` in standard time, `UTC-4` in daylight saving
   time).
2. Run:
   ```
   git log --before="<date>T00:00:00<ET-offset>" --format="%H" -1
   ```
3. Take the result — the newest commit across the whole repo that landed before that date's ET midnight.
4. If no commits exist before that date, report an error and stop.

## Phase 1: Spec Diff Report

1. Resolve the input to a concrete from-SHA using the rules above.
2. Run `git diff <from-sha>..HEAD -- docs/specs/` to produce the full diff scoped to the specs directory.
3. Categorize changed files:
   - **Added** — files present in HEAD but not in from-SHA
   - **Removed** — files present in from-SHA but not in HEAD
   - **Modified** — files present in both with changes
4. For each changed file, produce a scannable summary. Under the file heading, emit one sub-bullet per discrete change
   using this exact tab-delimited format:

   ```
   - <subfolder>	|	<change-type>	|	"<short description>"	|	<committed-by>
   ```

   - `subfolder`: the immediate child directory of `docs/specs/` containing the file (e.g. `technical`, `product`,
     `process`)
   - `change-type`: one of `added`, `removed`, `reworded`, `restructured`, or `clarified`
   - `short description`: a quoted phrase of ≤ 10 words describing the specific change
   - `committed-by`: the git author name of the commit that introduced this change — resolve by running
     `git log <from-sha>..HEAD --format="%H %an" -- <file>` and attributing each hunk to the commit that introduced it;
     if a file was touched by multiple commits, attribute each change to the appropriate commit's author

5. Print the resolved from-SHA so the user can pin to it in a future invocation.
6. **Pause and ask the user** whether to proceed to Phase 2. If the user declines, stop.

## Phase 2: Per-Change Spec Review

1. **Build a review checklist.** Enumerate every discrete change from Phase 1 in file order, printing them as an
   unchecked markdown checklist:

   ```
   - [ ] <subfolder>	|	<change-type>	|	"<short description>"
   ```

   This checklist is the authoritative ordering for the loop below.

2. Loop over every discrete change in checklist order, one change at a time. For each change:

   a. Print the change header matching the checklist entry (subfolder, change-type, short description, file path). b.
   Show the relevant content based on change-type:
   - **added** — show only the new content (current state).
   - **removed** — show only the removed content (original state, from `git show <from-sha>:<file>`).
   - **reworded / restructured / clarified** — show both the original excerpt and the current excerpt, clearly labelled
     `Before:` and `After:`. c. Prompt the user to choose:
   - **Accept** — change is correct; move to the next change.
   - **Modify** — user provides inline corrections; apply the edit to the spec file immediately, then move to the next
     change. d. Mark the corresponding checklist item `[x]` once the user accepts or modifies.

3. After all changes are reviewed, print a summary: count accepted vs. modified, and list any files that were edited. If
   any files were modified, those updated versions are used as the basis for Phase 3.

**Pause and ask the user** whether to proceed to Phase 3. If the user declines, stop.

## Phase 2.5: Post-Review File Integrity Check

Before proceeding to Phase 3, verify that every spec file edited during Phase 2 is well-formed:

1. Re-read each edited file and confirm no garbled content (e.g. linter merge artifacts, duplicate sentences, or stray
   fragments) was introduced during edits.
2. If corruption is found, fix it in place before continuing.

## Phase 3: Stale Implementation Discovery

**Scope:** Process all spec files that were **added, modified, or removed** in the diff range, using post-Phase-2
versions for any files edited in Phase 2.

- **Modified/removed** — search for code and docs that implement the old behaviour and are now misaligned.
- **Added** (non-draft) — search for whether any implementation of the new spec already exists; flag unimplemented
  requirements as "not yet implemented" work items.
- **Added** (status: draft) — skip; draft specs are not yet authoritative.

For each spec file in scope:

1. Read the current spec (or record deletion if removed).
2. Search the codebase for code, tests, and **other spec/doc files** that reference this spec, implement its
   requirements, or exercise the described behaviour. Search in this order:
   - **Requirement IDs first** (e.g. `D34`, `D45`, `M44`) — these are the most targeted keys.
   - Spec file path mentions.
   - Requirement keywords (MUST/SHOULD/MAY phrases).
3. For any **Phase 2 corrections** (changes the user modified rather than accepted): also search other spec and doc
   files for the old language that was corrected, and flag cross-spec inconsistencies as stale findings.
4. Reason about whether each found item is now misaligned with the updated, added, or removed spec.

After evaluating all in-scope specs:

1. Produce a grouped list: spec file → stale items (code, tests, or docs) with brief rationale for each. Explicitly call
   out areas that are **clean** (no stale findings) alongside areas with issues.
2. Cluster misaligned items by feature or domain area. Related spec changes affecting the same area go into one cluster;
   unrelated areas get separate clusters. Distinguish **doc-only fix** clusters (short, no code changes) from
   **implementation** clusters (require code work) and scope the resulting efforts accordingly.
3. For each cluster, invoke `$effort-new` to create a scoped effort file targeting the review and update work.
4. Output the list of created effort file paths.

## Output

- Resolved from-SHA used for the diff.
- Phase 1: Categorized file list with per-file change summaries.
- Phase 2: Accept/modify summary; confirmation of any edits applied.
- Phase 3: Stale implementation findings per spec, effort files created.
