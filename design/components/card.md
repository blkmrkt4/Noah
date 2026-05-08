# Card

The single most-used surface in Noah2. No nested cards — ever. If you think you need a card inside a card, use a divider and inline grouping instead.

## Anatomy

- Surface: `--color-surface` (#141416)
- Border: 1px `--color-border`
- Radius: `--radius-md` (6px)
- Padding: `--space-5` (20px) by default; `--space-4` (16px) for queue items; `--space-6` (24px) for question cards
- Shadow: `--shadow-0` by default; `--shadow-2` only when raised (dropdown source)

## Slots

- **header** — left: card title at `--text-heading-m`; right: status-pill or icon-only menu button
- **subtitle** — `--text-body-s` `--color-text-muted`, sits beneath header
- **divider** — 1px `--color-border-subtle`, full bleed inside padding
- **body** — main content; line length capped at `--content-max-ch` (72ch)
- **footer** — actions right-aligned; left side reserved for tertiary "view history" or "see audit"

## Variants

- **default** — card as above
- **interactive** — entire card is a click target (queue row); hover lifts border to `--color-border-strong`, surface to `--color-surface-raised`, transition `--motion-fast`
- **selected** — left border replaced with 3px `--color-accent-primary`; surface `--color-surface-raised`. Note: per quality floor, no rounded corners on single-sided borders — selected cards have `border-radius: 0` on the left edge only (rendered via inset box-shadow technique, not asymmetric radius).
- **flagged** — 1px `--color-danger` border, `--color-danger-surface` faintly tinting the card

## States

- **empty** — see `empty-state.md`
- **loading** — skeleton lines using `--color-surface-raised` blocks at body line-heights; no shimmer
- **error** — flagged variant + inline error message at top of body

## Don't

- No card inside card. Group with a divider.
- No hero-metric-layout — no giant single number occupying the card.
- No identical-card-grids of three — see hard limits.