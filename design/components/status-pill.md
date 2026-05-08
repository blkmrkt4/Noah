# Status pill

The primary signal for review state. Used everywhere a submission appears: queue rows, detail headers, audit log entries, exports.

## Anatomy

- Radius: `--radius-pill` (999px)
- Padding: 4px 10px
- Type: `--text-label` (12px / 600 / 0.04em / uppercase)
- Icon: 12px, optional, left of label
- Surface and text from the status token group

## States (review pipeline)

- **draft** — gray surface `--color-status-draft`, text `--color-text-muted`
- **submitted** — info-blue surface, text `--color-info`
- **in legal** / **in independence** / **in risk** — info-blue surface, text `--color-info`, prefixed with a 12px reviewer icon
- **needs input** — warning surface, text `--color-warning`
- **approved** — success surface, text `--color-success`, prefixed with check icon
- **rejected** — danger surface, text `--color-danger`, prefixed with x icon
- **escalated** — purple surface `--color-status-escalated`, text `#C39EFF` (purple-200 stop). The only place purple appears in product surfaces.

## Jurisdiction variant

A status pill can carry a jurisdiction prefix for multi-jurisdiction submissions: `UK · in legal`, `DE · approved`. Country code is in `--font-mono` for visual character alignment in lists.

## Don't

- No three-letter status codes ("APR", "REJ"). Plain language always.
- No floating-badges (banned) — the pill is anchored inline next to the entity name.