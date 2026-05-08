# ARC — Product Requirements Document

> **Load when:** scoping new work, answering "is this in V1?", or writing user-facing copy that should match the product vision. Sections are independent — load only the section you need rather than the whole file.

**Status**: V1 specification
**Owner**: Robin Hutchinson, Customer Success and Commercials Lead, Client Technology
**Reports to**: Mary Elizabeth Poray (MEP)

---

## 1. Vision

A single, AI-augmented intake and routing system that determines what risk reviews a technology product needs, in which jurisdictions, by whom, in what sequence, and with what evidence — and that does so once per asset, with delta reviews when the asset changes, rather than forcing duplicate intake into every separate risk function.

ARC replaces a status quo in which a product team answers substantially the same questions five to ten times across PIA, BIA, AIRA, AIQRM, InfoSec, OSS, NSS, BRIDGE, Naming, Brand, Accessibility, Data Retention, Contracts, and service-line overlays. Each function asks separately, demands its own evidence, runs its own demos, and times out independently. ARC consolidates intake, normalizes the body of evidence, routes only the questions each Reviewer actually needs, and orchestrates the parallel reviews against shared answers.

## 2. Problem statement

Today, getting a technology product approved for global deployment at EY requires the product team to navigate a labyrinth of overlapping risk functions, each with its own intake form, its own questions, its own evidence requirements, its own SLA, and its own dispositioning model. The same fact about a product — say, "this tool processes C3 data sourced from the client under SOW" — must be entered into PIA, AIQRM, OSS, NSS, and others, each time slightly differently. When any of those facts change, every function must be re-engaged from scratch.

The cost of this is real and measurable. Products are delayed by months. Reviewer capacity is consumed by re-asking questions the product team has already answered. The Commercial Owner — the partner or business sponsor who is accountable for the product going to market — has no single view of where the product stands across all reviews. And critically, when a product is approved for deployment in one country and the team subsequently wants to expand to another, they often have to redo the entire process rather than running a delta review against the new jurisdiction's increment over the global baseline.

ARC exists to fix this.

## 3. Goals and success metrics

### Primary goals

1. **Single intake.** A product team answers each foundational fact once, in one place, regardless of how many Reviewers will subsequently consume it.
2. **AI-augmented pre-population.** The system reads the product's existing documents and codebase and pre-fills as many answers as possible, with citations and confidence scores. The Commercial Owner reviews and either accepts or edits.
3. **Risk-led routing.** Foundational answers determine which sections of the questionnaire activate. A pure internal tool with no AI and no client data does not get asked AIQRM questions or OSS license questions.
4. **Parallel Reviewer engagement.** Sections can be released to their scoped Reviewers as they become ready, rather than waiting for the full project to be submitted. InfoSec can be reviewing Security while Privacy is still being completed.
5. **Fast-track via Patterns.** Pre-approved product archetypes ("Read-only C1 data viewer," "Internal-only assistant on approved AI platform with no client data") trigger waivers from named Reviewers, dramatically shortening the path to approval for low-risk products.
6. **Delta reviews on change.** When a product expands to a new country, adopts a new third-party model, or changes its data classification, ARC determines which Reviewers need to re-engage and which prior approvals still hold.
7. **Body of evidence persists.** Document extractions and repo findings are objective records that survive Commercial Owner attestation. Discrepancies between what the owner attests and what the system observes are first-class entities Reviewers can query as a unit of work.

### Success metrics

| Metric | Baseline (estimate) | V1 target |
|---|---|---|
| Time from intake to first Reviewer disposition | 4–8 weeks | 2 weeks |
| Number of times a product team answers the same foundational question | 5–10 | 1 |
| Percent of foundational answers AI pre-populated with confidence ≥ 0.7 | 0% | 60% |
| Percent of products eligible for fast-track via Pattern match | Unknown | Measure and grow |
| Reviewer time spent on a typical low-risk product review | 2–4 hours | 30 minutes |
| Commercial Owner satisfaction (NPS or equivalent) | Not measured | ≥ 40 |

## 4. Personas

See `personas.md` for the full taxonomy. In brief:

- **Commercial Owner** — accountable for the attestation, exactly one per project.
- **Collaborator** (Section Lead, Question Collaborator) — subject-matter contributors invited to answer specific questions or sections.
- **Reviewer** (Jurisdictional, Independence, Privacy, Brand, Security) — risk-domain experts who evaluate Released Sections and issue Dispositions.
- **Policy Author** — legal/risk professionals who maintain the question corpus, dependency graph, policy documents, Patterns, and per-question "more info" snippets.
- **System** — the AI-driven actor; pre-populates, extracts, scans, computes Pattern fit, flags Discrepancies. Never accountable.

A single human user can hold different personas across different projects.

## 5. Scope — what V1 includes

V1 is the full system as described in `data-model.md`. There is no lean MVP cut. Specifically:

### In scope for V1

- The full questionnaire engine with versioned questions, dependency-driven activation, and section-level state.
- Document ingestion with LLM-produced extractions, summaries, and citations.
- GitHub repository ingestion with commit-pinned RepoFindings.
- AI pre-population of answers with confidence and citation, owner-attestable.
- Discrepancy logging and Reviewer queryability.
- Section Release and Project Submission as distinct events.
- Multi-Reviewer parallel engagement.
- Reviewer-initiated Clarifications that temporarily reopen specific Answers.
- Pattern matching with continuous fit scoring during drafting.
- Fast-track waivers via Pattern reviewer_waivers.
- Delegation to Section Leads and Question Collaborators with appropriate authority levels.
- Threaded discussion attached to Answers, Reviews, Clarifications, and Delegations.
- Notification batching to avoid the "50 emails" problem, with urgent override.
- Policy version snapshot at Project Submission for audit reproducibility.
- Policy Author tooling to create/edit Questions, Dependencies, Patterns, and Policy Documents.

### Risk domains in scope for V1

All of the following have a Section in the question corpus and a corresponding Reviewer domain:

- Intake and triage (foundational; every project)
- Privacy and data protection (PIA, DSO data risk, cross-border transfer, retention)
- AI (AIRA classification, AIQRM quality risk management, agent governance)
- Independence (audit-client permissibility, BRIDGE for vendor relationships)
- Security (InfoSec assessment, Security Certification, Supplier Risk Assurance)
- Brand, Naming, and Accessibility
- Open Source Software (OSS) and Non-Standard Software (NSS)
- Contracts, IP ownership, and data rights
- Data retention and lifecycle
- Business Impact Assessment (BIA)
- Service-line overlays (Tax, Assurance, Consulting, SaT, Sustainability, Clients & Industries)

### Out of scope for V1

- Direct integration with downstream EY systems of record (EMPIRE, APM, GIS, GMS, SORT, SKU Database, Commercial Hub, Mercury). V1 captures the data; integration is V1.5.
- Per-question citation back to the source EY policy document. The question corpus is built; citations are added in V2.
- Mobile-native interface. Web responsive only in V1.
- Self-service onboarding for net-new Member Firms or service lines beyond the V1 set.
- Localization of the ARC interface itself into non-English languages.
- Automated re-scan of GitHub repos on schedule. V1 scans on-demand and on Project Submission.

## 6. The four parallel lifecycles

ARC is best understood as four streams that converge on a single artifact, the body of evidence. These run in parallel, not in sequence. See `architecture-spine.mmd` for the diagram.

### Stream 1: Ingestion

Documents (PRDs, security whitepapers, marketing material, architecture diagrams) and the GitHub repository are ingested into the project. The LLM produces DocExtractions (structured summary + extracted facts + source citations) and RepoFindings (objective facts about the codebase, pinned to commit SHA). DocExtractions feed pre-population. RepoFindings persist regardless of what is attested. Both are visible to Reviewers as evidence.

### Stream 2: Questionnaire

The Commercial Owner answers foundational questions first. Their answers determine which subsequent questions activate via the Question Dependency DAG. AI pre-populates answers from the ingestion stream, with confidence and citation. The owner accepts or edits. Sections become ready as their questions are answered. Section Leads can mark sections ready for Section Release. Question Collaborators answer their assigned questions.

### Stream 3: Pattern matching

As answers come in, the System continuously evaluates the project against every published PatternVersion. Each match has a fit score and a list of missing criteria. The Commercial Owner sees "you are on track to match Pattern X — answer 4 more questions to qualify." When a Pattern fully matches at Project Submission, that Pattern's reviewer_waivers determine which Reviewers' approvals are pre-granted, enabling fast-track.

### Stream 4: Review

Once a section is Released (during drafting) or the project is Submitted (full lock), the relevant Reviewers' Reviews open. Each Review is one Reviewer's evaluation of one Section (or the whole project, for cross-cutting domains like Independence and Brand). Reviewers can open Clarifications that temporarily reopen specific Answers. Once a Reviewer has no open Clarifications, they issue a Disposition (approve, conditional, reject). When all applicable Reviewers have issued Dispositions, the Project Disposition is computed.

These four streams converge on the body of evidence: attested Answers, DocExtractions, RepoFindings, Discrepancies, and Threads. One artifact, four producers, many consumers.

## 7. Workflows

### 7.1 Commercial Owner happy path

1. Commercial Owner creates a Project, names it, assigns themselves, lists target Jurisdictions and scope_type.
2. Commercial Owner uploads the product's PRD, marketing material, security whitepaper, and provides the GitHub repository URL.
3. The System ingests Documents and the repo. DocExtractions and RepoFindings are produced. Foundational and triage questions are pre-populated where possible, with confidence and citation.
4. Commercial Owner reviews foundational answers, accepts or edits, attests.
5. Triage answers determine which sections activate. Sections that don't apply are marked Not Applicable and skipped.
6. Commercial Owner invites Section Leads for sections requiring SME input (e.g., the security architect for Security, the AI lead for AI/ML).
7. Section Leads answer their sections; some questions are further delegated to Question Collaborators.
8. Sections are Released to Reviewers as they become ready. Multiple sections can be in Section Review state simultaneously.
9. Pattern matching runs continuously. If a Pattern reaches full fit, the Commercial Owner sees a fast-track indicator.
10. When all sections are Released and pre-submission validations pass, Commercial Owner Submits the Project.
11. Project Submission triggers cross-cutting Reviews (Independence, Brand) and pins the PolicySnapshot.
12. Reviewers issue Dispositions. Clarifications are raised and resolved as needed.
13. When all Reviewers have dispositioned, the Project Disposition is computed and the Commercial Owner is notified.

### 7.2 Reviewer happy path

1. Reviewer is notified that a Section has been Released or a Project Submitted within their domain and jurisdiction scope.
2. Reviewer opens the Review, sees the relevant Answers, the relevant DocExtractions, and the relevant RepoFindings, plus any Discrepancies.
3. Reviewer queries Discrepancies as a unit of work, dispositioning each (acknowledged, warrants follow-up, no action).
4. If any answers are unclear or insufficient, Reviewer opens a Clarification on the specific Answer. The Answer becomes editable. The Commercial Owner is notified.
5. Commercial Owner edits the Answer in the Clarification's context and Responds. The Clarification state moves Open → Responded.
6. Reviewer reads the response and either marks the Clarification Resolved or asks a follow-up.
7. When all Clarifications on the Review are Resolved, Reviewer issues a Disposition.

### 7.3 Policy Author workflow

1. Policy Author logs in to the corpus authoring tool.
2. They can create a new Question (which creates a Question entity and an initial QuestionVersion 1), edit an existing Question (which creates QuestionVersion N+1 — old versions remain immutable), or retire a Question.
3. They can edit Question Dependencies, defining the activation rule that determines when a child question becomes visible.
4. They can create or edit Patterns and PatternVersions, including the criteria, jurisdiction scope, and reviewer_waivers.
5. They can upload new PolicyDocs and PolicyVersions.
6. New projects pick up the latest published QuestionVersion. Existing projects retain the version they started with via the version pointer on each Answer. PolicySnapshot pins policy versions at Project Submission for full audit reproducibility.

### 7.4 Delta review workflow

1. A previously approved Project changes. Examples: a new country is added; a new third-party model is introduced; data classification escalates from C2 to C3.
2. Commercial Owner triggers a delta review by editing the relevant Answers.
3. The System determines which Reviewers' prior Dispositions are invalidated by the change and which still hold. Logic:
   - A Reviewer scoped to a jurisdiction not in the new scope is unaffected.
   - A Reviewer whose domain has any answer that changed is reopened.
   - Cross-cutting Reviewers reopen if any cross-cutting answer changed.
4. Only invalidated Reviews reopen. Prior approvals that remain valid persist. The Commercial Owner sees a clear diff of what is being re-reviewed and why.

## 8. The question corpus

The corpus is structured as YAML files, one per section, plus a foundational `intake.yaml` and routing `triage.yaml`. Each question carries a stable slug, a versioned prompt, an answer type, options where applicable, and a dependency rule indicating when it activates.

The DAG is the central design choice. Questions are not organized as a tree or as fixed tiers. They are nodes in a directed acyclic graph where activation is governed by activation rules over parent answers. This is what enables the "ask once, route everywhere" model: a foundational question like `data.classification.highest_tier` answered as C3 activates downstream privacy, AI, and contracts questions simultaneously without the user re-entering the fact.

See `questions/README.md` for the schema and `dependency-graph.mmd` for the visual DAG.

## 9. Pattern library

V1 ships with an initial set of Patterns to validate the fast-track mechanism. These will be expanded by Policy Authors over time. Initial patterns include:

- **Internal-only knowledge assistant on approved EY AI platform** — internal users only, EY-policy-only data (C2 approved), no client data, no automated decisions, on an approved EY platform → AIQRM and Privacy waived; Brand streamlined.
- **Read-only single-client viewer of client-supplied data under SOW** — single client, client data, read-only, no AI inference, SOW-bounded → DSO green-lane, expedited Privacy.
- **Public-domain data analytics tool, no personal data** — public/IP-free data only, no PII, no client data, internal users → Privacy waived, Independence streamlined.
- **Production AI agent with C3 client data and CIC** — full review path; Pattern documents what evidence is required so the team can prepare upfront.

Patterns are versioned. Their criteria reference question slugs, not question version IDs. Policy Authors are responsible for re-versioning a Pattern if a question's meaning materially changes.

## 10. Data classification — the C1/C2/C3/C4 spine

Almost every routing decision in ARC pivots on data classification:

- **C1** — Public, no restrictions.
- **C2** — Internal EY business information.
- **C3** — Confidential. Includes most client information.
- **C4** — Highly confidential client information.

Foundational question `data.classification.highest_tier` is the single most important answer in the corpus. It activates entire branches of Privacy, AI, Security, and Contracts questions. It is one of the questions where AI pre-population must be most rigorous, because misclassification at this layer cascades into bad routing everywhere downstream.

## 11. Jurisdiction model

Projects target one Jurisdiction, multiple, or "global." Jurisdictions are first-class entities. Reviewers are scoped to Jurisdictions. Patterns may have Jurisdiction scope. Questions may activate or deactivate based on Jurisdiction.

The `scope_type` enum on Project distinguishes between single-country, multi-country, and global, because "global" means something different for review routing than "all 157 countries individually selected." A global deployment routes to every applicable Jurisdictional Reviewer; a multi-country deployment routes only to the listed ones.

EY operates in 10 SuperRegions, each with a Regional Managing Partner and a CTO. The Jurisdiction tier enum captures regulatory grouping (high-regulation, standard, low-data, etc.) used by Pattern criteria and country-specific increments to the global independence policy.

## 12. AI ingestion and pre-population

The System ingests Documents (PDF, DOCX, PPTX, TXT, MD) and the GitHub repository on Project creation and on subsequent re-scans. It produces:

- **DocExtractions** — per-document structured output: summary, extracted facts, citations back to source spans.
- **RepoFindings** — per-finding objective fact about the codebase with file path, line number, and commit SHA. Examples: "OAuth2 used for authentication," "TensorFlow imported in `inference/model.py`," "Postgres connection string suggests data resides in eu-west-1," "GPL-licensed dependency detected: `gpl-package@1.2.3`."

These feed pre-population: the System proposes Answers with `source = system_inferred`, `ai_confidence` between 0 and 1, and a `citation` pointing to the supporting DocExtraction span or RepoFinding. The Commercial Owner reviews each pre-populated answer and either accepts (source flips to `owner_attested`) or edits (source flips to `owner_attested` with a logged Discrepancy).

The Commercial Owner's answer is always authoritative. The system's inferred value persists in the Discrepancy if the owner edited it. Reviewers see both, plus the citation.

## 13. Notification strategy

The "50 emails" problem — a Collaborator gets 50 separate emails for 50 questions in one project — is solved at the Notification entity layer through batched digests. See `data-model.md` § Notification strategy for the detail.

User preferences for digest cadence, channel (push, email, in-app), and urgency overrides are stored in a NotificationPreference table not yet modeled. Easy to add; deferred until UX is firmed up.

## 14. Audit and reproducibility

Every Answer carries the QuestionVersion it was answered against. Every Project at Submission pins a PolicySnapshot of the relevant PolicyVersions. Every Reviewer Disposition is timestamped and immutable. RepoFindings are pinned to commit SHA. DocExtractions reference the Document version they were produced from.

This means: at any point in the future, a Policy Author or external auditor can ask "as of when this Project was submitted, what version of every question, every policy, every dependency rule, every pattern definition applied?" and get a deterministic answer.

Soft deletes are not used. If a record needs to be removed, that is a design decision, not an automatic column.

## 15. Open product questions

The following are deliberately unresolved at the PRD level. Some are also flagged in `data-model.md` § Open questions.

1. **Recursive collaboration.** Currently a Section Lead can delegate to Question Collaborators, but Question Collaborators cannot further delegate. For genuinely deep technical questions (e.g., a security architect punting an encryption-specific question to the platform team), this may be too restrictive. **Decision needed before**: Section Lead persona is used in production.

2. **Policy retroactivity for in-flight projects.** PolicySnapshot pins versions at Project Submission. But what about projects in Drafting when a policy updates? Three options: continue against the old policy, switch to the new policy automatically, or notify the Commercial Owner with a choice. **Decision needed before**: the first policy update lands.

3. **Clarification re-review scope.** When a Clarification reopens an Answer in an already-Cleared section, does the SectionState revert to Section Review for all Reviewers or only the Reviewer who raised the Clarification? Recommendation in `data-model.md` is "only the relevant Reviewer." **Decision needed before**: first Clarification on a Cleared Section is raised.

4. **GitHub re-scan policy.** RepoFinding has commit_sha to pin findings to a code state. But the project's "current findings" view needs a rule: latest commit only, diff against last submission, or all findings ever? **Decision needed before**: first delta review is run.

5. **Cross-cutting Reviews and section_id null.** Independence and Brand reviews attach to the project, not a section, so section_id is nullable in REVIEW. Is this acceptable, or should we introduce a synthetic "whole project" Section? **Decision needed during**: schema migration.

6. **Pattern slug stability.** PatternVersion criteria reference questions by slug, not version ID. This assumes question slugs preserve meaning across versions. The system has no automatic check for this. **Decision needed before**: first Pattern is published.

7. **Per-project explicit roles vs. derived.** Currently Commercial Owner is a column on Project; Collaborators are derived from Delegations; Reviewers are derived from Reviews. No ProjectMembership table. **Decision needed if**: read-only access or co-ownership is required.

8. **NotificationPreference.** Per-user settings (digest cadence, channels, urgency overrides) are referenced in the strategy section but not modeled. **Decision needed before**: UX for notification settings is built.

## 16. Non-goals

- ARC does not replace the Reviewer functions. It orchestrates them.
- ARC does not adjudicate disagreements between Reviewers. Conflicting Dispositions surface to the Commercial Owner and to risk leadership for resolution outside the system.
- ARC does not enforce remediation of conditional approvals. It records them; remediation is tracked in the Reviewer's own function.
- ARC does not handle financial transactions, billing, or commercial terms. Those flow through the Commercial Hub and Mercury via the SKU Database.
- ARC does not perform legal interpretation. It routes to the right Reviewer; the Reviewer makes the legal call.

## 17. Dependencies on other Client Technology systems

ARC is part of a broader Client Technology product portfolio. V1 captures the data structures needed to integrate with these systems but does not implement the integrations themselves. Integration targets:

- **EMPIRE** — system of record for Client Technology assets. ARC's Project should ultimately link to an EMPIRE asset record.
- **APM** — Asset Portfolio Management. The APM ID is captured as a foundational Question.
- **SKU Database** — for assets that become commercially available, the SKU is the bridge to the Commercial Hub.
- **Commercial Hub** — once an asset is approved by ARC, it can be made available in the Commercial Hub for engagement teams to provision.
- **GIS / GMS / SORT / BRIDGE** — independence tooling. ARC's Independence section captures the answers; the Reviewer engages the underlying tools.
- **Mercury** — financial system; downstream of Commercial Hub, not directly integrated with ARC.

## 18. Glossary

See `glossary.md` for the merged EY domain and ARC system glossary.
