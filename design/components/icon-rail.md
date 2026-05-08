# Icon-rail (primary navigation)

Fixed left rail. Collapsed by default at 56px. Expanded to 240px when pinned or hovered. Carries persistent labels via instant tooltip when collapsed; inline labels when expanded.

This is icon-rail, not icon-tile (which is banned). Items are vertical-stack icons with hairline dividers, not a tiled grid.

## Anatomy

- Width: collapsed `--icon-rail-width` (56px); expanded `--icon-rail-width-expanded` (240px)
- Surface: `--color-surface`
- Right border: 1px `--color-border`
- Header: 56px tall, contains the EY logo (`assets/EY_Logo_Beam_C_CMYK.svg` at 32px) centered when collapsed, left-aligned with horizontal lockup when expanded (uses `assets/EY_Logo_Beam_STFWC_Horizontal_Large_C_Spot_OffBlack_Yellow_EN.svg`)
- Item height: 44px
- Item icon: 20px, centered when collapsed
- Item label: `--text-body-m` (14px), 12px gap from icon, only visible when expanded

## Items (commercial owner role)

- New risk submission
- My submissions
- In review
- Action required
- Archive
- Help

## Items (reviewer roles — legal, independence, risk management)

- Queue
- Assigned to me
- Awaiting clarification
- Closed
- Archive

## States

- **default** — icon `--color-text-muted`
- **hover** — icon `--color-text`, surface `--color-surface-raised`, transition `--motion-fast`. Tooltip with label appears instantly to the right when collapsed.
- **active** (current route) — icon `--color-accent-primary`, 3px left bar `--color-accent-primary` flush left
- **with badge** — small dot `--color-accent-primary` at top-right of icon when item has unseen items; count badge for >9

## Pinning

- Pin button at the bottom of the rail toggles between collapsed and pinned-expanded
- Pin state persists in user preferences
- Hover-expand only triggers if not pinned; 200ms hover delay before expand to prevent accidental triggers

## Don't

- Never an icon without a tooltip when collapsed.
- Never icon-tile (a 2-wide grid of square tiles) — that's a banned pattern.
- Never put role-switcher in the rail; it lives in the user menu top-right.