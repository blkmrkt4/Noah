# Admin scaffolding

Admin lives at `/admin`. Role-based middleware on every `/admin/*` route. Audit log on every write. Same tokens as the consumer app, with compact density on tables.

## Layout

- Top bar: 56px, surface `--color-surface`, contains: "Admin" wordmark left, environment selector (prod / staging / sandbox), user menu right
- Side rail: 56px wide icon-rail, same component as consumer app, with admin-specific items
- Content: full remaining width, max `--container-max`

## Sections

### LLM configuration (`/admin/llms`)

- **List view**: table of configured LLMs — provider, model id, primary-or-backup tag, last-tested timestamp, status pill
- **Detail view**: model id, endpoint, key reference (never the key itself — see audit), failover rules (chained backup model selection), test playground
- **Test playground**: free-text prompt input, model select, side-by-side response panel, latency badge, token-count badge, all in `--font-mono` for the response itself

### Prompt and model binding (`/admin/prompts`)

- **List view**: table of slugs — slug, current version, bound model, last-edited-by, last-edited-at
- **Detail view**: slug header, version dropdown (with "rollback to this version" tertiary button per row in the version list), prompt body in a `--font-mono` editor, variable list, bound-model selector, "save as new version" primary
- Versioning is immutable — versions are append-only; rollback creates a new version pointing at an old body

### User and role management (`/admin/users`)

- **List view**: table — email, role, status (active / suspended / invited), last-seen
- **Actions**: invite (modal-equivalent slide-over with email + role), change role (inline confirmation row, see button.md destructive pattern), suspend (inline confirmation), reset access
- Role definitions are read-only here; defined in code

### Usage analytics and cost tracking (`/admin/usage`)

- **Top filters**: date range picker, group-by (LLM / user / slug)
- **Cards**: total cost, total tokens, total calls — three metric cards, no nested cards
- **Chart**: stacked bar, daily, segmented by group-by dimension. This is the only place purple and cyan from the extracted palette appear (categorical encoding for many LLMs).
- **Table**: sortable, exportable to CSV, columns auto-fit content

### Content and output moderation (`/admin/moderation`)

- **Queue**: reuses `reviewer-queue.md` component, scoped to flagged outputs
- **Detail view**: original prompt, generated output, flag reason, override list (toggleable), threshold sliders for category-specific cutoffs
- **Actions**: approve (success), reject and add to override list (warning), escalate to human review (info)

## Audit log

- Every admin write action emits an audit log entry: actor, action, entity, before, after, timestamp
- Audit log surface at `/admin/audit` — read-only, paginated table, search by actor or entity
- Audit entries cannot be deleted; this is an architectural invariant

## Tokens specific to admin

```
--admin-table-row-height:        32px         /* compact, default */
--admin-table-header-height:     40px
--admin-table-cell-pad:          8px 12px
--admin-monospace-cell:          var(--font-mono), --text-mono-s
```

Identifiers, model ids, hashes, version numbers, and timestamps in admin tables use `--font-mono` for character alignment. This is the documented exception to the `monospace-as-technical` ban — alignment carries information here, mono is not decoration.