# Analysis Lenses

## Purpose

Capture reusable analysis methods for turning transcripts or structured notes into implementation-ready insight.

## Last Verified

2026-03-26

## How To Use This Doc

1. Pick one or more analysis types below based on your objective.
2. Run each analysis independently.
3. Merge approved outputs into specs, reference docs, or implementation plans.

## Lens Processing Protocol

Every lens follows this approval workflow when producing findings:

1. Present with evidence. Each finding includes the excerpt it was derived from, linked to the source line span:
   `["quote" - Transcript Name](<transcript-path>#L<start>-L<end>)`.
2. Present one finding at a time with the relevant template fully populated.
3. Prompt for approval with `Accept`, `Modify`, or `Reject`.
4. Write only approved findings into the target document.

## Analysis Types

### Event/Moment Analysis

- Goal: Describe workflow as moments where a trigger causes a role to act.
- Typical Output: Moment cards.

### Decision/Rules Analysis

- Goal: Extract policy and decision logic from narrative process descriptions.
- Typical Output: Decision tables and rule statements.

### Data/State Analysis

- Goal: Clarify entities, field origins, and lifecycle states.
- Typical Output: Data lineage map and state model.

### Role/Permission Analysis

- Goal: Define who can see, edit, approve, or escalate each artifact or step.
- Typical Output: Role-action matrix.

### Exception/Failure Analysis

- Goal: Model off-nominal flows and recovery behavior.
- Typical Output: Exception scenario catalog.

### Cadence/Capacity Analysis

- Goal: Understand time rhythm and workload distribution.
- Typical Output: Cadence map and load hotspots.

### Visibility/Reporting Analysis

- Goal: Define information needs by role and decision horizon.
- Typical Output: Role-based visibility requirements.

### Domain/Glossary Analysis

- Goal: Extract terms, definitions, naming conventions, and business logic into the glossary.
- Typical Output: Glossary candidate cards.
- Output Target: [`/docs/specs/process/domain-glossary.md`](/docs/specs/process/domain-glossary.md)

## Shared Templates

### Moment Card Template

- Trigger:
- Actor:
- Intent:
- Action Today:
- Knowledge Used:
- Pain/Risk:
- Desired System Behavior:
- Evidence: ["quote" - Transcript Name](<transcript-path>#L<line>)

### Decision Table Template

- Decision:
- Inputs:
- Rules:
- Outcomes:
- Evidence: ["quote" - Transcript Name](<transcript-path>#L<line>)

### Exception Scenario Template

- Failure/Exception:
- Detection:
- Immediate Action:
- Escalation:
- Recovery/Resolution:
- Evidence: ["quote" - Transcript Name](<transcript-path>#L<line>)

### Glossary Candidate Card Template

- Candidate ID: G-<seq>
- Operation: new-term | update-term | new-business-logic | new-naming-convention
- Glossary Section: <section>
- Term: <term>
- Proposed Entry:
- Existing Entry:
- Rationale:
- Evidence: ["quote" - Transcript Name](<transcript-path>#L<line>)

## Maintenance

- Add or adjust analysis types as workflow maturity increases.
- Keep each analysis type independent and reusable.
- Record refreshes by updating `Last Verified`.
