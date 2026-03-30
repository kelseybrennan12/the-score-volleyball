---
name: ingest-transcript
description:
  Ingest a meeting transcript by storing it, selecting analysis lenses, and producing reference documentation.
---

# Ingest Transcript

## Use When

- User provides a new meeting transcript to incorporate into the project knowledge base.
- User asks to analyze a transcript through one or more analysis lenses.
- A meeting has occurred and its transcript needs to be processed into structured reference docs.

## Inputs

- `transcript`: required. Path to the transcript file, or the raw transcript content to be stored.
- `slug`: required if storing a new file. Short hyphenated description for the filename (e.g.,
  `po-meeting-transcription`).
- `date`: required if storing a new file. Meeting date in `YYYY-MM-DD` format.
- `lenses`: optional. List of analysis lens names from
  [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) to apply. If omitted, propose lenses based
  on transcript content and ask user to confirm before proceeding.

## Workflow

1. **Store transcript** (if not already stored):
   - Save to `/docs/meetings/YYYY-MM-DD-<slug>.txt`.
   - Verify the file is plain text with speaker labels and line breaks preserved.

2. **Select lenses**:
   - Read [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) for available analysis types and
     shared templates.
   - If `lenses` input is provided, use those.
   - If not provided, scan transcript content and propose relevant lenses with brief justification.
   - Wait for user confirmation before proceeding.

3. **Apply each selected lens**:
   - Follow the **Lens Processing Protocol** defined in
     [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) — present each finding with transcript
     evidence, prompt accept/modify/reject, write only approved findings.
   - For each lens, check whether a matching reference document already exists in
     [`/docs/reference/`](/docs/reference/).
   - If an existing doc covers the same domain, merge new findings into it.
   - If no existing doc matches, create a new reference document following the naming pattern
     `<domain>-<lens-output-type>.md`.
   - Include required sections: Purpose, Last Verified, Scope (with source transcript link), Method, Transcript Sources.
   - The `Transcript Sources` section lists every transcript (path + date) that contributed to the document.
   - Use shared templates from [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) where
     applicable (Moment Card, Decision Table, Exception Scenario).
   - Include evidence as linked transcript references for every finding, using the format:
     `["Quote text" - Meeting Name](docs/meetings/YYYY-MM-DD-slug.txt#L<line>)`. For line ranges use `#L<start>-L<end>`.
     The meeting name should be a short human-readable label (e.g., "PO Meeting 2/11", "Working Session 2/18").
   - If a lens produces more than ten cards/entries, also produce or update a narrative sidecar
     (`<domain>-<lens-output-type>-narrative.md`).
   - **Domain/Glossary Analysis — additional steps**:
     1. Read the current glossary at [`/docs/specs/process/domain-glossary.md`](/docs/specs/process/domain-glossary.md).
     2. Scan the transcript for domain terms, definitions, naming conventions, abbreviations, business logic, state
        lifecycles, and policy clarifications.
     3. For each candidate, classify against the existing glossary:
        - **No match** → `new-term` (or `new-business-logic` / `new-naming-convention`)
        - **Match with different content** → `update-term`
        - **Equivalent match** → skip (do not propose)
     4. Use the Glossary Candidate Card template with all fields populated. For updates, include a diff showing existing
        vs proposed content.
     5. Write accepted candidates to the glossary. Maintain the glossary's existing table/section structure — append to
        the correct section or create a new section if the term doesn't fit existing categories.
     6. After all candidates are processed, update the glossary's `Last Updated` date.

4. **Update indexes**:
   - Add new reference documents to [`/docs/reference/README.md`](/docs/reference/README.md).
   - Add the transcript to the Sources section of
     [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) if not already listed.
   - If the Domain/Glossary Analysis lens was applied, no `/docs/reference/` document is created — output goes to
     [`/docs/specs/process/domain-glossary.md`](/docs/specs/process/domain-glossary.md) instead. No README update is
     needed for glossary-only runs.

5. **Report**:
   - List all files created or updated.
   - List any open questions or ambiguities discovered in the transcript.
   - For Domain/Glossary Analysis: list accepted terms, skipped terms, and any terms the developer modified (with
     before/after summary).

## Output

- Stored transcript path.
- List of reference documents created or updated, one per applied lens (plus sidecars if applicable).
- List of updated index files.
- Open questions discovered during analysis (if any).
