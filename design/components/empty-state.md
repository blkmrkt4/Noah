# Empty state

Illustrated, per brief. Three contexts: empty queue, empty submission list, no search results.

## Anatomy

- Container: full card body, centered alignment for the illustration block only (text below is left-aligned to `--content-max-ch` — note: `centered` is banned as a layout register, but isolated centering for an empty-state graphic is permitted because the surrounding card frame provides asymmetric anchoring)
- Illustration: 160×120 SVG, drawn from the project icon library, in `--color-text-faint` line work with one accent stroke in `--color-accent-secondary`
- Title: `--text-heading-m`, `--color-text`
- Body: `--text-body-m`, `--color-text-muted`, max 2 lines
- Action: primary or secondary button, single

See `assets/empty-queue.svg`, `assets/empty-submissions.svg`, `assets/empty-search.svg`.

## Voice

- Direct. Says what's missing and what to do.
- "No submissions yet. Start a new risk review." — yes
- "Looks like there's nothing here! Why not create your first thing?" — no (generic-hero-copy)