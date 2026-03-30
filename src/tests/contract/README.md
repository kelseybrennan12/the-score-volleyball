# Contract Tests

## Purpose

Validate interface/schema compatibility at API and integration boundaries.

## Allowed File Kinds

- Request/response schema compatibility tests.
- Consumer/provider contract assertions for external integration adapters.

## Rules

- Verify payload shapes and boundary expectations with plain value contracts.
- Keep contracts independent from adapter implementation details.

## Disallowed Patterns

- Treating contract tests as full workflow/e2e tests.
- Leaking infrastructure-native types into contract assertions.

## Notes for Future Files

- Keep fixtures versioned and explicit when boundary contracts evolve.
