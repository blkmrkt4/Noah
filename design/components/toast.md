# Toast

Notifications. Bottom-right stack. Auto-dismiss after 5s for info/success, 8s for warning (with undo on destructive actions), persistent for danger until dismissed.

## Anatomy

- Surface: `--color-surface-raised`
- Border-left: 3px solid semantic color (info / success / warning / danger)
- Border: 1px `--color-border-strong`
- Radius: `--radius-md` — but per the quality floor's "no rounded corners on single-sided borders" rule, the left edge has `border-radius: 0` and the other three corners use `--radius-md`. (This is the documented exception; the alternative — full border with internal accent stripe — was tested and reads less crisply.)
- Padding: 12px 16px
- Width: 360px fixed
- Stack gap: `--space-2` (8px)
- Icon: 16px, semantic color, left of title
- Title: `--text-heading-s`, `--color-text`
- Body: `--text-body-s`, `--color-text-muted`, max 2 lines then ellipsis
- Action: tertiary button (e.g. "Undo"), right side
- Close: icon-only X, top-right, 16px

## Motion

- Enter: slide in from the right, `translateX(20px) → 0`, opacity `0 → 1`, `--motion-base`
- Exit: opacity `1 → 0`, `--motion-fast`; do not animate position out (stack reflow looks unstable)

## Variants

- **info** — `--color-info`
- **success** — `--color-success`
- **warning** — `--color-warning`
- **danger** — `--color-danger`, persistent

## Don't

- No more than 4 toasts visible — older ones evict.
- No toast for a missing required field — that belongs inline in the form.
- Toasts never carry the only undo path for destructive actions; the action remains undoable from the audit log.