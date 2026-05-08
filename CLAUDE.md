# CLAUDE.md

## What you are building

**EY ARC** (Attestation, Risk & Compliance) — EY's risk attestation system for technology products. A Commercial Owner answers a dependency-driven set of questions about a product, AI pre-populates from documents and the GitHub repo, and multiple Reviewers across risk domains evaluate and disposition the result in parallel.

The full specification lives in `docs/`. The design system lives in `design/`. **Do not load all of either at once** — see the routing manifests below.

## Read this first, every session

Before any work, read these in order:

1. **`docs/burningplatform.md`** (~100 lines) — *why* ARC has to exist. Every design decision in the spec is downstream of the pain described here. If a feature feels "nice but maybe not necessary," go back to the burning platform; the answer is usually there.
2. **This file** — conventions and routing.

That's the always-on context. Total budget: ~250 lines. Everything else is loaded on demand.

## Routing manifest — docs (load on demand)

Each row says: load this file when the trigger matches your task. Don't load speculatively. Every large file in `docs/` also has a `Load when:` header at the top, repeating its trigger; if the trigger doesn't match what you're doing, close the file.

| File | Load when… |
|---|---|
| `docs/prd.md` | Scoping new work, deciding "is this V1?", or writing user-facing copy that should match the product vision. Sections are independent — load only the section you need. |
| `docs/data-model.md` | Writing or modifying anything that touches the schema, migrations, ORM definitions, or entity relationships. **Required reading before adding any new entity.** Skip when working on UI-only or pure logic. |
| `docs/personas.md` | Building auth, permission checks, role-scoped UI, delegation flows, or any feature where "who can do this?" is the question. |
| `docs/risk-domains.md` | Working on triage logic, reviewer assignment, section activation rules, or routing more broadly. |
| `docs/glossary.md` | Looking up a term you don't recognize (PIA, AIRA, BRIDGE, CIC, SOW, SORT, GIS). Treat as a dictionary — open, look up, close. Don't load preemptively. |
| `docs/architecture-spine.mmd` | Reasoning about how the four streams (Ingestion / Questionnaire / Patterns / Review) interact. Useful for cross-stream features. |
| `docs/dependency-graph.mmd` | Understanding how foundational answers cascade into section activation. Useful when adding new questions or debugging unexpected section visibility. |
| `docs/questions/README.md` + `docs/questions/_schema.yaml` | Building or modifying the corpus loader, or authoring new questions. |
| `docs/questions/intake.yaml` | Almost any work touching the questionnaire — these are the foundational answers everything else depends on. |
| `docs/questions/triage.yaml` | Working on routing, section activation, fast-track logic. |
| `docs/questions/<section>.yaml` | Working on that specific section's review domain. Load one or two at a time, not all of them. |
| `docs/questions/_sections.yaml` | Adding or reordering sections, or wiring new sections to reviewer domains. |
| `docs/questions/_patterns.yaml` | Working on Pattern matching, fast-track determination, or extending the Pattern library. |
| `docs/build-plan.md` | At the start of new work — phase plan, open product questions, things to confirm with Robin before cutting a branch. |

**Never load all 12 section YAMLs at once.** The legitimate use cases (corpus-wide audit, global slug rename) are better handled with a script than with context.

If a session feels like it needs everything, the session is too broad — split it.

## Routing manifest — design (load on demand)

The design system lives at `design/`. It is the source of truth for all UI work. Same discipline as docs: load only what the trigger calls for.

| File | Load when… |
|---|---|
| `design/design.md` | Starting any UI work — orientation, component catalog, project-wide bans (no glassmorphism, no modals, no avatar initials, etc.). Required reading before touching `design/components/*`. |
| `design/tokens.md` | Picking colours, spacing, type, motion, radius, or elevation values. Required reading before any styling work. **Never hard-code values; always reference tokens by name.** |
| `design/components/button.md` | Building or modifying buttons (primary, secondary, tertiary, destructive, icon-only). |
| `design/components/input.md` | Building text, textarea, select, multi-select, date, or file inputs. |
| `design/components/card.md` | Building surface containers, question cards, or reviewer cards. |
| `design/components/icon-rail.md` | Working on the primary navigation rail. |
| `design/components/form.md` | Building inline or stacked form layouts, branching question groups. |
| `design/components/tooltip.md` | Adding tooltips. Note: instant-reveal, label-bearing only. |
| `design/components/toast.md` | Surfacing notifications or confirmations. |
| `design/components/empty-state.md` | Building empty containers. |
| `design/components/progress.md` | Indicating in-session progress (saving, validating, generating). |
| `design/components/status-pill.md` | Indicating long-running review states (Pending Legal, In Independence, Approved, Rejected). |
| `design/components/branching-question.md` | Building or modifying ARC's signature surface — a question that reveals follow-ups based on answer. The most-loaded component file in this project. |
| `design/components/reviewer-queue.md` | Building list views for reviewer queues. |
| `design/ADMIN-SCAFFOLDING.md` | Working on admin surfaces. |
| `design/assets/` | Embedding the EY logo or other brand marks. |

**Never load all component files at once.** If you change a component, update its file in `design/components/` so the design system stays the source of truth.

## Conventions

### Naming

- `snake_case` for database columns and YAML keys.
- `PascalCase` for entity names in prose and code (`Project`, `Question`, `ReviewerDisposition`).
- `ALLCAPS` for entity names in Mermaid sources, per Mermaid convention.
- `kebab-case` for file names (`risk-domains.md`).

### Versioned entities

Three entities follow the same versioning pattern:
- `Question` + `QuestionVersion`
- `Pattern` + `PatternVersion`
- `PolicyDoc` + `PolicyVersion`

The pattern is: stable identity row + immutable version rows + a join from project-scoped data to a specific version. Do not introduce new versioning patterns. If you find another entity that needs versioning, follow this same shape.

### Polymorphic associations

Used sparingly. Currently only `Thread.parent_type` (Answer / Review / Clarification / Delegation). Don't introduce new ones without discussion.

### JSON columns

Used for genuinely variable structure: `activation_rule`, `scope_target`, `digest_payload`, `criteria`, `jurisdiction_scope`, `reviewer_waivers`, `extracted_facts`. Do not use JSON to dodge schema design when a real table would do.

### Soft deletes

Not used. If something needs to be removed, that is a design decision, not a column we add automatically. The audit trail concern is too important.

### Question slugs

Question slugs are stable across versions. They are the human-readable identifier. Examples: `data.classification.highest_tier`, `ai.exists`, `client.is_audit_client`. Use dotted notation grouped by domain. Never include version numbers in the slug.

### Activation rules

Stored as JSON on `QuestionDependency`. The rule references a parent question by slug (not version ID), and an answer condition. The DAG has no automatic check that a question slug's meaning hasn't changed materially across versions — Policy Authors are responsible for re-versioning patterns and dependencies if a meaning changes.

## The corpus is incomplete in V1

The `docs/questions/` files contain the structural skeleton: every section is represented, every foundational and triage question is captured, and the highest-leverage section-specific questions are present. The full deep-question set (e.g., the 50+ AIRA questions from source materials) will be filled in by Policy Authors over time. Where a section file says "more questions to be added by Policy Authors," that is intentional — not a gap for you to fill on your own.

You **may** suggest additional questions you think are missing, but flag them as suggestions and do not add them to the corpus without Robin's review.
