# Button

Rounded shape, sharp shadow philosophy, snappy motion. Five variants. Buttons say what they do — no redundant UX writing, no every-button-primary.

## Variants

- **primary** — EY yellow surface, near-black text. One per surface.
- **secondary** — transparent surface, 1px `--color-border-strong`, body text. Default action.
- **tertiary** — text only, no border, no surface. Used inline in prose, in table rows, and as the "back" affordance.
- **destructive** — transparent surface, 1px `--color-danger` border, `--color-danger` text. Always paired with an undo path or escape (see Patterns below).
- **icon-only** — square 32×32 (compact) or 40×40 (touch). Always carries an instant tooltip with text label.

## Anatomy

- Padding: compact 8px 14px, comfortable 10px 18px
- Radius: `--radius-lg` (8px)
- Type: `--text-heading-s` (14px / 600 / 0.01em)
- Min-width: 80px (prevents single-character buttons)
- Icon size: 16px, gap 8px between icon and label
- Disabled: 40% opacity, cursor not-allowed, no hover state

## States

- **default** — surface as variant
- **hover** — primary lifts to `--color-accent-primary-hover`; secondary border to `--color-border-strong` + surface to `--color-surface-raised`; transition `--motion-fast` on `transform: translateY(-1px)` and opacity
- **active** — primary drops to `--color-accent-primary-pressed`; transform `translateY(0)`; transition `--motion-instant`
- **focus** — `--shadow-focus` ring; remains through keyboard navigation
- **loading** — replace label with `progress` component (12px circular indeterminate); button width locked to prevent reflow; pointer-events: none
- **disabled** — see anatomy

## Patterns

- Destructive button always sits inside an inline confirmation row, not a modal. Pattern: button click reveals an inline 44px row with "Are you sure? [Confirm] [Cancel]"; confirm runs the action; toast shows with "Undo" tertiary button for 8 seconds.
- Primary action right-aligned in form footers; secondary left of primary; tertiary left-most.
- Never two primary buttons on the same surface.

## Don't

- No primary on every action — most actions are secondary.
- No icon-only without tooltip.
- No bouncy easing on hover.
- No animating padding or margin to "expand" on hover — animate transform only.