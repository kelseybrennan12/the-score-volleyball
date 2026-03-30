# Transcript Ingestion

## Spec Metadata

- ID: PR0009
- Type: Process
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define how transcripts or structured notes are analyzed through reusable lenses and turned into reference documentation
that feeds spec authoring and implementation planning.

## Goals

- Establish a repeatable, agent-executable process for extracting structured insight from conversations.
- Standardize provenance, naming, and output expectations.
- Ensure analysis outputs are traceable back to source material.

## Non-Goals

- Defining the content of individual analysis lenses.
- Automating transcript creation from audio or video.
- Replacing human judgment on which lenses are relevant for a given conversation.

## Requirements

### Must:

- Transcripts are treated as working inputs, not required shipped artifacts in the sanitized starter baseline.
- If a transcript is checked into the repository for a temporary workflow, use the naming convention
  `YYYY-MM-DD-<slug>.txt`.
- Each ingestion run selects one or more analysis lenses from
  [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md).
- The user confirms lens selection before analysis begins.
- Each applied lens produces or updates at least one reference document in [`/docs/reference/`](/docs/reference/).
- Every reference document includes:
  - a `Purpose` section
  - a `Last Verified` date
  - a provenance section citing transcript or note sources
  - a `Method` section naming the analysis type
- Evidence references in output documents cite transcript line numbers or short excerpt quotes.
- When a new transcript covers a domain with existing reference docs, merge findings into the existing doc rather than
  creating a new one.
- [`/docs/reference/README.md`](/docs/reference/README.md) is updated to list any new reference documents produced.

### Should:

- Use the shared templates from [`/docs/reference/analysis-lenses.md`](/docs/reference/analysis-lenses.md) where the
  selected lens defines one.
- Produce a narrative sidecar document alongside detailed card or table output when the finding count becomes large.
- Use `.txt` for raw transcripts and `.md` only when the source has been editorially structured.

### May:

- Apply multiple lenses in a single ingestion run.
- Record open questions or ambiguities in the output reference docs.

## Open Questions

- None.

## Completion

- Status: Implemented
- Remaining: None.
