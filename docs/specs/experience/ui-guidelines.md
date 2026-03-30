# UI Guidelines

## Spec Metadata

- ID: EX0001
- Type: Experience
- Status: active
- Version: v2
- Last Updated: 2026-03-26

## Summary

Define loose design guidelines for UI development so the starter remains visually coherent, accessible, and easy to
extend.

## Goals

- Provide a single reference for visual and interaction consistency.
- Maintain accessible defaults across starter surfaces.
- Give agents practical guidance without forcing a rigid design system.

## Non-Goals

- Prescribing exact pixel values or exhaustive tokens.
- Replacing comprehensive design-system documentation.
- Defining backend or runtime architecture.

## Guidelines

### Must:

- Use semantic HTML structure.
- Keep interactive elements keyboard-accessible.
- Meet WCAG AA contrast standards for text and interactive elements.
- Provide clear labels and validation feedback for forms.
- Indicate loading states for async operations.
- Use accessible focus indicators.
- Define shared color values as CSS custom properties in [`/src/frontend/tailwind.css`](/src/frontend/tailwind.css).
- Use semantic token names rather than literal color names.
- Route new UI work through app-owned primitive components rather than importing third-party primitives directly into
  feature code.

### Should:

- Keep typography, spacing, border radius, and elevation choices consistent across starter surfaces.
- Favor clarity over cleverness in labels and helper copy.
- Distinguish primary actions from secondary actions visually.
- Keep disabled, error, success, and notice states visually distinct and consistent.
- Build layouts so they remain legible across desktop and mobile breakpoints.

### May:

- Use subtle animation to guide attention or confirm interaction.
- Introduce stronger page-specific visual hierarchy when it helps the starter feel intentional rather than generic.

## Related

- [`/docs/figma/specs/pages.md`](/docs/figma/specs/pages.md)
- [`/src/frontend/tailwind.css`](/src/frontend/tailwind.css)

## Open Questions

- None.

## Completion

- Status: Partial
- Remaining:
  - Continue tightening shared tokens and component usage as new starter surfaces are added.
