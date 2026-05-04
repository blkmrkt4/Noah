# ARC Question Corpus

> **Load when:** building or modifying the corpus loader, authoring new questions, or implementing the questionnaire engine. Pair with `_schema.yaml`. Skip if you're not touching corpus mechanics.

The corpus is structured as YAML files, one per section, designed for direct ingestion into the database via a corpus loader. Every question carries a stable slug, a versioned prompt, an answer type, options where applicable, and a dependency rule indicating when it activates.

## Files

| File | Purpose | Domain |
|---|---|---|
| `_schema.yaml` | The schema definition every question file must conform to | meta |
| `_sections.yaml` | Section registry (Claude Code: please draft) | meta |
| `_patterns.yaml` | Initial Pattern library (Claude Code: please draft) | meta |
| `intake.yaml` | Foundational questions — every project answers these | foundational |
| `triage.yaml` | Routing questions that determine which sections activate | triage |
| `privacy.yaml` | Privacy, data protection, PIA, DPIA, cross-border, retention | privacy |
| `ai.yaml` | AIRA, AIQRM, DSO data risk, agent governance, third-party model | ai |
| `independence.yaml` | Audit-client permissibility, BRIDGE, own-work, SORT | independence |
| `security.yaml` | InfoSec, Security Certification, SRA, AI InfoSec Assessment | security |
| `brand.yaml` | Brand, naming, UX, Motif Design System | brand |
| `accessibility.yaml` | WCAG 2.1 AA, accessibility testing | accessibility |
| `oss.yaml` | Open Source Software | oss |
| `nss.yaml` | Non-Standard Software | nss |
| `contracts.yaml` | Contracts, IP, ownership, data rights | contracts |
| `retention.yaml` | Data retention, log retention, deletion | retention |
| `bia.yaml` | Business Impact Assessment | bia |
| `service-lines.yaml` | Service-line overlays (Tax, Assurance, Consulting, SaT) | service-lines |

## Question schema

Every question is an entry in a YAML list. The minimal shape:

```yaml
- slug: data.classification.highest_tier
  prompt: "What is the highest data classification used by the asset?"
  answer_type: single_select
  options:
    - {value: c1, label: "C1 — Public, no restrictions"}
    - {value: c2, label: "C2 — Internal EY business information"}
    - {value: c3, label: "C3 — Confidential (most client information)"}
    - {value: c4, label: "C4 — Highly confidential client information"}
  required: true
  ai_prepopulation_priority: high
  activates_when: []   # foundational — no parents
```

A question with parents:

```yaml
- slug: ai.aira.regulatory_tier
  prompt: "What regulatory tier does this AI system map to?"
  answer_type: single_select
  options:
    - {value: unacceptable, label: "Unacceptable"}
    - {value: high, label: "High"}
    - {value: limited, label: "Limited"}
    - {value: minimal, label: "Minimal"}
  required: true
  activates_when:
    - parent_slug: ai.exists
      condition: equals
      value: true
```

A question with multiple parents (AND semantics by default):

```yaml
- slug: privacy.dpia.required
  prompt: "Is a DPIA required under GDPR Article 35?"
  answer_type: single_select
  options:
    - {value: yes, label: "Yes"}
    - {value: no, label: "No"}
    - {value: unsure, label: "Unsure — flag for Privacy Reviewer"}
  required: true
  activates_when:
    - parent_slug: data.types.includes_personal_data
      condition: equals
      value: true
    - parent_slug: ai.exists
      condition: equals
      value: true
```

For OR semantics, use a single `activates_when` entry with `condition: any_of` and a list of conditions.

## Answer types

- `single_select` — one of N options (radio).
- `multi_select` — zero or more of N options (checkboxes).
- `boolean` — yes/no.
- `text_short` — one-line free text.
- `text_long` — multi-line free text.
- `number` — numeric.
- `date` — calendar date.
- `entity_ref` — reference to another entity (User, Jurisdiction, ServiceLine, Vendor, etc.).
- `entity_ref_multi` — list of entity references.
- `url` — URL with format validation.

## Activation conditions

- `equals` — parent answer equals value.
- `not_equals` — parent answer is not equal to value.
- `in` — parent answer is in a list of values.
- `not_in` — parent answer is not in a list of values.
- `contains` — for `multi_select` parents, parent answer list contains value.
- `not_contains` — for `multi_select` parents, parent answer list does not contain value.
- `any_of` — list of nested conditions; activate if any are true.
- `all_of` — list of nested conditions; activate if all are true (this is the default for multiple `activates_when` entries).

## Other fields

- `required` (bool) — whether this question must be answered before its Section can be Released.
- `ai_prepopulation_priority` (`high` / `medium` / `low` / `none`) — guidance to the ingestion pipeline for how aggressively to attempt pre-population.
- `help_text` (string, optional) — additional guidance shown to the user.
- `examples` (list of strings, optional) — illustrative examples of valid answers.
- `routes_to_review_domains` (list, optional) — explicit list of Reviewer domains this question feeds. Mostly inferred from the section, but can be overridden.

## What V1 contains and what it doesn't

V1 ships with the structural skeleton: every section is represented, every foundational and triage question is captured, and the highest-leverage section-specific questions are present. The full deep-question set (the 50+ AIRA questions, the full DSO data risk taxonomy, every NSS branch) is not exhaustive — Question Authors will fill these in over time.

Where a question file says "more questions to be added by Question Authors," that is intentional — it is not a gap for Claude Code to fill on its own.

Per-question citations back to source EY policy documents are out of scope for V1. They are planned for V2.
