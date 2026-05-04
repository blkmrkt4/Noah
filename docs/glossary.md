# ARC Glossary

> **Load when:** looking up a specific term you don't recognize. Treat as a dictionary — open, look up, close. Don't load preemptively at session start.

A single source of truth for terms used across the ARC system. Two parts:

1. **EY domain terms** — what the underlying EY risk functions, tools, and processes mean. ARC routes to and orchestrates these; it does not replace them.
2. **ARC system terms** — what the entities, states, and processes inside ARC itself mean.

---

## Part 1 — EY domain terms

### Review functions

**PIA (Privacy Impact Assessment)** — A review of how a system or process handles data, especially personal data, client data, and confidentiality-sensitive information. Confirms what data the product collects, how it flows through the product, what privacy and confidentiality obligations apply, and whether the solution has addressed them. Governed by the EY Global PIA Procedure and based on GDPR principles.

**BIA (Business Impact Assessment)** — A review of how important an application is to business operations and what would happen if it failed or became unavailable. Confirms business criticality and the level of continuity, recovery, and resilience planning required.

**SRA (Supplier Risk Assurance)** — A review of risks created by vendors or third parties that process, host, access, or handle EY or client confidential data. Confirms whether a supplier can meet required information security standards.

**InfoSec assessment / Security Certification** — A security review and certification process for an application that includes vulnerability testing and validation of required security controls. Confirms the right protections are in place and remediation items are addressed before go-live. Governed by the EY Global Information Security Policy.

**BRIDGE** — Short for the Business Relationships Independence Data Gathering and Evaluation review. Determines whether a proposed third-party relationship or vendor arrangement creates an impermissible independence issue or requires formal independence assessment and approval.

**OSS review (Open Source Software)** — Review of open source components used in a product. Subject to review by Architecture, Information Security, GCO, and Independence. Confirms legal, security, architectural, and independence risks are addressed.

**NSS review (Non-Standard Software)** — Process for software that is not part of the standard approved software route. Hinges on who is obtaining the license and what data types are shared, which determines whether Security Consulting, BRIDGE, GCO, or Data Protection need to engage.

**Naming review** — Confirms the proposed name fits naming conventions, does not conflict with existing products or solutions, and does not create commercial or IP risk with prior rightsholders.

**Data retention review** — Confirms the product has clear retention rules, ownership for archiving and deletion, and an approach addressing legal discovery, regulatory compliance, and cybersecurity risk.

**AIRA (AI Risk Assessment)** — Assessment that classifies an AI system by lifecycle stage, regulatory tier, role/type (provider or deployer), business impact, and complexity. Upstream AI classification step driving downstream reviews (AIQRM, PIA, InfoSec).

**AI QRM / AIQRM (AI Quality Risk Management)** — Structured, risk-based framework for managing risk across the AI lifecycle. Looks at validation status, testing evidence, monitoring plans, periodic review cadence, and closure of action items. Sits alongside and after AIRA.

**Contracts review (GCO)** — Legal and commercial review of agreements connected to the product, including ownership, licensing, funding, and use of non-EY IP. Confirms ownership, EY's rights to use or distribute, licensing obligations, and any restrictions on deployment or reuse.

**Quality / service-line overlays** — Service-line-specific regulatory, professional, and operational requirements layered on top of the general product governance process. Cover Tax, Strategy and Transactions, Consulting, Assurance-related requirements.

**DPIA (Data Protection Impact Assessment)** — A data protection assessment used to test whether new or changed activities involving personal information are compliant with data protection requirements. "GDPR Art. 35 DPIA requirement" is the threshold for moving an AI use case from green-lane to yellow-lane.

**ROPA** — Local process used in Germany to document and review local processing of personal data before moving into a PIA where appropriate.

### Tools and platforms

**EY Fabric** — Technology and data platform combining technology and data capabilities with business insights to design and deliver solutions for EY clients.

**One EAM (One Enterprise Asset Management)** — Initiative unifying EY's management of assets across Global and Member Firms through their full lifecycle in a single ecosystem. Provides standardized asset taxonomy, discovery, lifecycle governance, end-to-end visibility, and consistent governance across global, regional, and service-line boundaries.

**EMPIRE** — The Client Technology enterprise inventory and system of record for Global and Member Firm products, applications, and platforms used to enable client delivery. Includes Category 1, 2, and 3 assets. Maintains ownership, key asset attributes, supports lifecycle management, and helps confirm assets align with strategy, governance, and compliance.

**APM (Asset Portfolio Management)** — Capability tracking and managing the portfolio of technology assets, assigning unique identifiers, and ensuring proper lifecycle management from funding through decommissioning.

**GIS / GMS** — Independence systems used to verify restricted entities and permissible investments. Referenced in EYG Independence Policy.

**SORT** — Service-Oriented Reference Tool. Used by Independence (RM Independence) to evaluate services delivered via a tool and identify permissibility against restricted clients.

**SKU Database** — EY system where all SKUs for technology assets are stored. Bridge to Commercial Hub for commercially available assets.

**Commercial Hub (CT Hub)** — System where assets will be displayed and engagement teams can build technology cost estimates, order items, and let product teams see orders. Forms a procurement and management pipeline. Some products require provisioning labor by the Service Line product team.

**Mercury** — EY financial system. Receives expenses from Commercial Hub via the Billing Hub.

### Functions and groups

**DSO (Data Stewardship Office)** — Function driving design and delivery of AI data risk monitoring in intake requests; provides early global guidance and baseline control objectives for data-related governance. Performs the green-lane AI data risk check.

**BMC (Brand, Marketing and Communications)** — EY function responsible for brand, marketing, public relations/media relations, and communications. Early BMC involvement accelerates naming approvals.

**GCO** — EY's legal/contracts function. Reviews contracts, licensing, OSS, and related legal matters.

### Contractual and consent terms

**CIC (Client Information Consent)** — Client-consent clause/standard intended to enable broader use of client data where the clause has been rolled out and accepted. Used as a condition for green-lane paths because it establishes broader-than-engagement use rights for client data.

**SOW (Statement of Work)** — Contractual document capturing work activities, deliverables, and timeline. Used as a boundary condition for whether a use case is within original client/engagement purpose.

### Data classification

**C1** — Public, no restrictions.
**C2** — Internal EY business information.
**C3** — Confidential. Includes most client information.
**C4** — Highly confidential client information.

### Lifecycle and testing

**UAT (User Acceptance Testing)** — Business/user testing process validating that a system meets agreed acceptance criteria before implementation.

**PoC (Proof of Concept)** — Time-boxed tactical experiment validating whether a specific approach, technology, or capability is feasible.

**GPAI (General-Purpose AI) system / model** — A general-purpose AI model or system, such as a broad foundation-style model. Treated as a distinct AIQRM profile/system-type.

---

## Part 2 — ARC system terms

### Personas

See `personas.md` for full descriptions. In brief: Commercial Owner, Collaborator (Section Lead, Question Collaborator), Reviewer (Jurisdictional, Independence, Privacy, Brand, Security), Question Author, System.

### Entities

**Project** — A single product attestation. Top-level container. One Commercial Owner, one or more target Jurisdictions. Status progresses Drafting → Project Submission → Project Review → Project Disposition.

**Section** — A grouping of questions (Security, AI/ML, Data residency, Independence, Brand, Privacy, etc.). The unit of release; can be Released to scoped Reviewers independently of the rest of the project.

**SectionState** — Per-project, per-section state machine: Drafting → Released → Under Review → Cleared.

**Question** — A stable identity for something that needs answering. Has a slug (e.g., `data.classification.highest_tier`) that remains stable across versions.

**QuestionVersion** — A specific published wording of a Question, with answer type, options, and dependencies. Once published, immutable.

**QuestionDependency** — An activation rule: "child question becomes active when parent's answer satisfies condition X." Stored as JSON.

**Foundational Question** — Informal term for a Question with no prerequisites. Entry points to the questionnaire.

**Answer** — A specific Commercial Owner's response to a specific QuestionVersion on a specific Project. Carries value, source (system_inferred / owner_attested / collaborator_supplied), AI confidence and citation if pre-populated, timestamp.

**Document** — A file ingested into the project (PRD, security whitepaper, marketing material, architecture diagram).

**DocExtraction** — LLM-produced structured output from a Document: summary, extracted facts, source citations.

**RepoFinding** — Objective fact about the codebase from static analysis or LLM inspection. Pinned to commit SHA. Persists regardless of attestation.

**Discrepancy** — Logged divergence between an owner-attested Answer and a system-inferred value. First-class entity Reviewers query as a unit of work.

**Pattern** — A pre-approved archetype for a product (e.g., "Read-only C1 data viewer"). Stable identity.

**PatternVersion** — A specific definition of qualifying answer values, jurisdiction scope, and reviewer waivers.

**PatternMatch** — A Project's current fit against a PatternVersion, computed continuously. Includes fit_score and missing_criteria.

**Delegation** — An assignment of a Question or Section from one user to another. Has scope_type (section / question_set), scope_target, status, and `delegate_authority` controlling further delegation.

**Thread** — A polymorphic conversation attached to an Answer, Review, Clarification, or Delegation.

**Comment** — A single message within a Thread. Authored, timestamped, may reference specific answers or findings.

**Review** — One Reviewer's evaluation of one Section of one Project. Cross-cutting reviews (Independence, Brand) attach to the project as a whole.

**Clarification** — Reviewer-initiated request that temporarily makes a specific Answer editable. States: Open → Responded → Resolved.

**Reviewer** — Role record linked to a User, scoped to a domain and one or more jurisdictions.

**Disposition** — A Reviewer's outcome: approve, conditional, reject. Issued once no Clarifications are open.

**Project Disposition** — Aggregate outcome computed from individual Reviewer Dispositions: Approved, Conditionally Approved, Rejected, Pending.

**User** — Global identity. `global_roles` JSON captures system-wide permissions.

**Jurisdiction** — Country or region. `tier` enum captures regulatory grouping used by Pattern criteria.

**Notification** — Unit of delivery, batched. `digest_payload` JSON holds the rolled-up event list.

**PolicyDoc** — Stable identity for an underlying policy document used during ingestion (e.g., "EY Global Information Security Policy").

**PolicyVersion** — Immutable published content of a PolicyDoc, with `effective_at` date.

**PolicySnapshot** — At Project Submission, the system pins the current PolicyVersion of every relevant PolicyDoc. Enables full audit reproducibility.

### Process states and events

**Drafting** — Commercial Owner and Collaborators are working on answers. Sections are in flux. No Reviewer visibility yet.

**Section Release** — A section is locked from project-team editing and made visible to its scoped Reviewers. Multiple Sections can be Released independently and at different times.

**Project Submission** — The full project is locked and made visible to all applicable Reviewers, including cross-cutting ones. Determines fast-track vs standard track.

**Section Review** — A Reviewer's active evaluation of a Released Section.

**Project Review** — The collective state of all active Reviews. The Project is "in Review" once any Section Review is active.

**Cleared** — Per-Section state once every applicable Reviewer has issued an approving or conditional Disposition for that Section.

**Body of evidence** — The full set: attested Answers + DocExtractions + RepoFindings + Discrepancy log + Threads.

**Fast-track** — Expedited path when a PatternMatch achieves full fit. Specific Reviewers may auto-approve via the Pattern's `reviewer_waivers`.

**Standard track** — Default path. All applicable Reviewers must issue Dispositions.

**Delta review** — Re-review triggered when an approved Project changes (new country, new third-party model, escalated data classification). Only invalidated Reviews reopen; prior approvals that remain valid persist.
