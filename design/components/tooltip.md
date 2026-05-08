# Tooltip

Instant reveal — no delay. Carries the label content for icon-only buttons and the role definitions for jurisdiction tags.

## Anatomy

- Surface: `--color-surface-raised`
- Border: 1px `--color-border-strong`
- Radius: `--radius-sm`
- Padding: 6px 10px
- Type: `--text-body-s` (13px), `--color-text`
- Max-width: 280px
- Arrow: 6px triangle, same surface as tooltip
- Position: prefers right; falls back top, bottom, left in that order to stay in viewport

## Motion

- Open: `--motion-tooltip` (0ms — instant)
- Close: `--motion-fast` (120ms) — gentle fade so cursor doesn't trail an empty arrow

## Variants

- **default** — single line label
- **rich** — title + 1-line description, used for jurisdiction tags ("UK Independence — reviewed under UK FRC rules")

## Don't

- No tooltips for required body information — that's a hidden cancel pattern.
- No tooltips that contain interactive elements.