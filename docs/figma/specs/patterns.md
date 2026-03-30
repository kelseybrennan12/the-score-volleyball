# Behavioral Patterns

Cross-cutting UI conventions for the starter screens.

## Status Presentation

Use a small, consistent status vocabulary across the starter:

| State                | Meaning                                                     |
| -------------------- | ----------------------------------------------------------- |
| Healthy / Available  | The backing runtime or dependency is responding normally    |
| Pending / Running    | An async action is in progress                              |
| Warning              | Something is available but degraded, incomplete, or delayed |
| Failed / Unavailable | The action or dependency did not succeed                    |

Prefer semantic tokens from the active app theme instead of hard-coded export colors.

## Card Types

Two lightweight card patterns should cover most starter screens:

- **Status card**: short label, prominent value/state, optional helper text
- **Detail card**: section heading plus key-value rows, tables, or explanatory copy

## Empty States

Empty states should explain why a section is blank and what the user can do next.

Examples:

- No example jobs have been queued yet
- Database metadata is unavailable because the connection failed
- No authenticated session is present

## Async Actions

The Jobs page is the main example of an async mutation flow.

- Trigger actions from a clearly labeled primary button
- Show pending state immediately
- Preserve the result in the page after reload by reading persisted backend state
- Distinguish transport failure from job-level failure

## Navigation

- Top-level starter navigation should remain small and obvious
- Active-page indication should be visible without relying on color alone
- Cross-links from Dashboard to Database and Jobs should feel like guided next steps, not like a dense app menu

## Tables And Key-Value Lists

- Use tables when rows are comparable across the same columns, such as recent jobs or metadata entries
- Use key-value groups for short runtime and session summaries
- Truncate or wrap long technical values carefully so pages stay readable on smaller screens
