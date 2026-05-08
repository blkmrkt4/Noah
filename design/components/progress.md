# Progress

In-session progress only. For long-running review states use `status-pill.md` instead — progress bars imply known duration, which review timelines do not have.

## Variants

- **linear-determinate** — for known-duration operations: file upload, export, batch validation. Height 4px, surface `--color-surface-raised`, fill `--color-accent-primary`. Animates `transform: scaleX()` from 0 to 1, never width.
- **linear-indeterminate** — saving, autosave, async validation. Same height/surface; fill is a 30% wide segment that translates left-to-right, 1.4s cycle.
- **circular-indeterminate** — 12px or 16px, used inside buttons and inputs. Single arc rotating, 0.8s cycle.

## Don't

- Never progress for things that take longer than 30s — use status-pill.
- Never animate width — animate transform only.