# EY ARC — Design system orchestrator

EY ARC is a multi-jurisdiction risk management workflow. A commercial owner answers a base set of questions; answers branch into deeper questions; outputs are routed to legal, independence, and risk-management reviewers across jurisdictions. This system serves that workflow — it is a product, not a showcase.

## Register

Product, dark, technical. Design serves the task. Restraint is the dominant trait. Energy comes from contrast, motion crispness, and confident typographic hierarchy — not saturation, scale, or decoration.

## Identity & brand

EY ARC carries EY brand marks. The two brand SVGs ship with the bundle:

- `assets/EY_Logo_Beam_C_CMYK.svg` — primary mark, used in the icon-rail header and on auth screens
- `assets/EY_Logo_Beam_STFWC_Horizontal_Large_C_Spot_OffBlack_Yellow_EN.svg` — horizontal lockup, used on document exports, print views, and the auth/landing surface

Brand yellow `#FFE600` is the primary accent. The user brief listed `#FFC107` as accent-primary, but that conflicts with EY's authoritative yellow and would render the supplied logos off-brand. `#FFC107` is retained as the warning amber instead. See `tokens.md` for the full reasoning under `Color decisions`.

## Tokens

All tokens — colour, type, spacing, radius, motion, elevation — live in `tokens.md`. Every component file references tokens by name; no component should hardcode hex, px, or ms values.

## Components

Core components — every product surface uses these:

- `components/button.md` — primary, secondary, tertiary, destructive, icon-only
- `components/input.md` — text, textarea, select, multi-select, date, file
- `components/card.md` — surface container; question card; reviewer card
- `components/icon-rail.md` — primary navigation
- `components/form.md` — inline + stacked layouts, branching question groups
- `components/tooltip.md` — instant-reveal, label-bearing
- `components/toast.md` — notification surface
- `components/empty-state.md` — illustrated empty containers
- `components/progress.md` — in-session progress (saving, validating, generating)
- `components/status-pill.md` — long-running review states (Pending Legal, In Independence, Approved, Rejected)
- `components/branching-question.md` — Noah2's signature surface; a question that reveals follow-ups based on answer
- `components/reviewer-queue.md` — list view used by legal, independence, risk reviewers

Library components: none selected for this project. All components above are project-native.

## Patterns

- **Question flow**: a single branching-question per screen at compact density, with the branch trail visible above and the projected remaining-question count visible below. No modal interruptions. Save state on every input change; debounce 400ms.
- **Reviewer view**: split layout — queue on the left (icon-rail-adjacent), case detail on the right. Compact tables, sticky headers, no hidden columns.
- **Status communication**: progress for things that finish in seconds, status pills for things that take hours or days, toasts for confirmations.
- **Multi-jurisdiction**: every reviewable artefact carries a jurisdiction tag (status pill variant) and a reviewer-role tag. Never hide jurisdiction context inside a tooltip.

## Admin

Admin scope is full. Architecture and surface specifications live in `ADMIN-SCAFFOLDING.md`. Admin uses the same tokens as the consumer app at compact density on tables.

## Quality floor

Inherited from the brief and locked into this system:

- WCAG AA contrast minimum (4.5:1 body, 3:1 large)
- Body text minimum 14px; line-height minimum 1.3
- No nested cards
- No skipped heading levels
- Animate transform/opacity only
- Every component has empty/loading/error states
- Errors in plain language, never codes
- Destructive actions have undo or escape

## Banned in this project

glassmorphism, gradient-text, glow, centered, pure-bw, side-tab, icon-tile, dark-neon, emoji-as-icon, floating-badges, identical-card-grids, hero-metric-layout, sparklines-decorative, rounded-rect-generic-shadow, three-card-trio, Inter, monospace-as-technical, single-font, flat-type-hierarchy, overused-fonts, bouncy, modals, every-button-primary, redundant-ux-writing, amputating-mobile, generic-hero-copy, avatar-initials.

Note on `modals`: review confirmations use a non-modal slide-over from the right, dismissable with Esc. Destructive confirmations use an inline confirmation row inside the affected card, not an overlay.

Note on `monospace-as-technical`: Cascadia Code is reserved for tabular data, code, IDs, hashes, and timestamps where character alignment carries meaning. It is never used as decoration to imply seriousness.
