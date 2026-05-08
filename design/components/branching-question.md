# Branching question

Noah2's signature surface. A question whose answer reveals follow-ups. The visible chain of revealed sub-questions makes the conditional logic legible to the commercial owner.

## Anatomy

- Container: card variant, padding `--space-6`, no nested cards
- Question number: `--font-mono` `--text-mono-s`, `--color-text-faint`, top-left ("Q3.2")
- Question text: `--text-heading-l` (18px / 600), max line length `--content-max-ch`, `--color-text`
- Help/context: `--text-body-m`, `--color-text-muted`, below question, max 3 lines
- Answer affordance: input variant appropriate to the question type (radio, select, text, multi-select)

## Branching reveal

- When the answer triggers follow-ups, sub-questions appear inside the same card with a 1px `--color-border-subtle` divider above each
- Sub-question type: `--text-heading-m`, indented 24px, with a small dot indicator `--color-accent-primary` at left margin
- Reveal animation: opacity 0→1 + transform `translateY(8px)→0`, `--motion-base`
- Each sub-question can itself branch — recursion limit of 3 levels deep, beyond which a new question card is created with a "continued from Q3.2" breadcrumb

## Trail

Above the question card, a breadcrumb shows the answered chain:

```
Q1 (yes) → Q2 (engagement) → Q3 ▸
```

Each completed segment is a tertiary button, clicking jumps back to that question. Current question shown with `--color-accent-primary` chevron.

## Footer

- Left: tertiary "back" + tertiary "save draft"
- Right: secondary "skip if optional" + primary "next"
- Skip is hidden if the question is required

## Layout decision (compact + branching tension)

The brief specifies inline form layout and compact density. For questions with two or fewer follow-up branches, inline holds. For questions with more than two branches — common in jurisdictional risk questions — the question switches to stacked layout inside the same card. This decision is made per-question by the question definition, not by the user.

## Don't

- No question dialogs (modals are banned).
- No more than one branching question per visible viewport — scrolling to find sub-questions defeats the trail metaphor.