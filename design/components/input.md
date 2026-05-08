# Input

Text, textarea, select, multi-select, date, file. Every input has empty, loading, error, and disabled states.

## Anatomy

- Surface: `--color-surface-sunken` (#08080A) — sits visually deeper than the card it lives in
- Border: 1px `--color-border`; `--color-border-strong` on hover; `--color-accent-primary` (1px) on focus, plus `--shadow-focus`
- Radius: `--radius-sm` (4px)
- Padding: 8px 12px (compact), 10px 14px (comfortable)
- Height: 32px (compact), 40px (comfortable)
- Type: `--text-body-m` (14px); placeholder uses `--color-text-faint`
- Caret: `--color-accent-primary`

## Label

- Position: above input
- Type: `--text-label` (12px / 600 / 0.04em / uppercase)
- Color: `--color-text-muted`
- Required marker: a 6px dot in `--color-accent-primary` to the right of the label, never the word "required"
- Optional marker: the word "optional" in `--color-text-faint` to the right; never the asterisk inversion

## Help text and error

- Help text below input, `--text-body-s` (13px), `--color-text-muted`
- Error replaces help text on validation failure, `--color-danger`, prefixed with a 14px alert icon
- Error language is plain. Not "ERR_VALIDATION_FAILED". Yes "Enter a date in the past."

## States

- **empty** — placeholder visible
- **loading** — for async-validated fields, an 12px indeterminate progress sits inside the right edge; field remains editable
- **error** — border `--color-danger`, error message replaces help
- **disabled** — surface `--color-surface`, text `--color-text-faint`, cursor not-allowed
- **read-only** — no border, no surface, just text — used in confirmation views

## Specific input types

- **textarea** — auto-grows from 3 rows to 12 rows, then scrolls. Resize handle hidden.
- **select** — uses `dropdown` component on open; chevron icon at right, 12px
- **multi-select** — chip-based; chips are status-pill variants in `--color-info-surface`; backspace removes the last chip
- **date** — fixed mask `YYYY-MM-DD` for jurisdiction-neutral parsing; calendar opens on focus, instant
- **file** — drag target with `--color-border-strong` 1px dashed; on hover dashed becomes solid

## Don't

- No floating labels (legibility issue against compact density)
- No inline error icons inside the field — use border + below-field message
- No clearing the input on validation error