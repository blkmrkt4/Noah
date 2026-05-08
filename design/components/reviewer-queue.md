# Reviewer queue

The list view used by legal, independence, and risk-management reviewers. Sits in the queue pane (left side of reviewer split layout). Compact rows, sticky header, no hidden columns.

## Anatomy

- Pane width: `--queue-pane-width` (360px)
- Right border: 1px `--color-border`
- Header: 44px sticky, surface `--color-surface-raised`, contains: title, count badge, filter icon-button, sort icon-button
- Row: 76px tall, padding `--space-3` `--space-4`, 1px `--color-border-subtle` divider between rows, no border on first/last
- Selected row: surface `--color-surface-raised`, 3px left bar `--color-accent-primary`

## Row content

- Top line: submission title, `--text-heading-s`, truncated with ellipsis at one line
- Mid line: status pill + jurisdiction pill, gap 8px
- Bottom line: submitter name + relative timestamp ("Jordan Lee · 2h ago"), `--text-body-s`, `--color-text-muted`
- Right column (24px wide): unread dot `--color-accent-primary` (4px), or empty

## Filter and sort

- Filter opens a dropdown with: jurisdiction, submitter, status, date range, assigned-to-me toggle
- Sort options: most recent, oldest, status priority, submitter alphabetical
- Active filters appear as removable chips below the header

## Empty state

See `empty-state.md` — the empty-queue variant.

## Don't

- No avatar-initials in the row (banned). Submitter is text-only or with a real photo when present.
- No nested cards inside the row.