---
name: audit
description:
  Run typed audits across specs, docs, and code patterns. Use this for spec alignment, link hygiene, documentation
  checks, and other audits defined by project process guidance.
---

# Audit

## Use When

- User asks to run an audit, evaluate alignment, or check process conformance.
- A loop step says to audit after execution.
- You need a deterministic report for follow-up work.

## Inputs

- `audit_type`: required (for example `spec-alignment`, `link-hygiene`, `documentation`).
- `scope`: optional path; default is repo root.

## Discovery

1. Read project process audit guidance when present (for example
   [`/docs/specs/process/audits.md`](/docs/specs/process/audits.md)).
2. Read scope-relevant folder `README.md` files that contain audit guidance.
3. Merge cross-cutting checks with folder-specific checks.

## Audit Types

### `spec-alignment`

- Verify MUST/SHOULD requirements are implemented or explicitly deferred.
- Report mismatches, aligned partials, and required spec updates.

### `link-hygiene`

- Scan all markdown files in scope.
- Detect:
  - markdown links
  - file-path-like plain text that is not linked
- Valid internal links must be exactly `[label](/absolute/path)`.
- Classify findings:
  - `invalid_syntax`
  - `non_absolute_path`
  - `missing_target`
  - `plain_path_not_linked`

Aggressive path-like candidate patterns:

- strings containing `/` with known path segments (for example `docs/specs/`, `docs/efforts/`, `.agents/`)
- filenames with common extensions (for example `.md`, `.py`, `.ts`, `.tsx`, `.json`, `.yaml`, `.yml`)
- inline-code path literals in markdown

### Other Types

- Execute checklists from project process audit guidance and scope-relevant `README.md` files.

## Output

Use a deterministic report format. For `link-hygiene`, use the project template when one is defined.

For all other types:

```
# Audit Report
- Audit Type:
- Date:
- Scope:
- Sources:

## Summary

## Findings
- File:
  - Line:
  - Severity:
  - Check:
  - Evidence:
  - Suggested Fix:

## Follow-up Work
- [ ] Create/Update effort file:
- [ ] Apply fixes:
- [ ] Re-run audit:
```
