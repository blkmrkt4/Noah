# Form

Forms are inline-layout by default per the brief. Branching question groups switch to stacked when a question has more than two follow-up branches — see `branching-question.md`.

## Inline layout (default)

- Label and input on the same row, label left, input right
- Label width: 240px, right-aligned
- Input fills remaining space up to `--content-max-ch`
- Row gap: `--space-4` (16px) between rows
- Help text wraps under input only, never under label

## Stacked layout (when triggered)

- Label above input, both left-aligned
- Used for: questions with branching follow-ups; multi-paragraph questions; questions with attachments
- Row gap: `--space-5` (20px)

## Sections

- Form sections separated by 1px `--color-border-subtle` divider with section title at `--text-heading-s`, uppercase, `--color-text-muted`
- Section padding: `--space-6` top, `--space-4` bottom

## Submit / cancel

- Footer right-aligned, primary submit button right-most, secondary cancel left of it
- Sticky footer when form exceeds viewport
- "Save draft" tertiary button left-most in footer

## Validation

- On blur for individual fields
- On submit for cross-field constraints
- Error summary appears at top of form on submit failure, links to first error field, focus moves there
- Inline errors per field (see `input.md`)

## States

- **empty** — sections collapsed if optional, expanded if required
- **dirty** — sticky footer "Save draft" lights up with `--color-accent-primary` text
- **submitting** — primary button enters loading state, all inputs disabled
- **error** — error summary at top + inline errors per field

## Don't

- No reset button — destructive without escape.
- No required asterisks — see `input.md` for the dot pattern.
- No clearing form on validation failure.