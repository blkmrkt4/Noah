# ARC Personas

> **Load when:** building auth, permission checks, role-scoped UI, delegation flows, or any feature where "who can do this?" is the question. Skip for pure backend infra work.

Personas describe roles within a specific project context, not user types in the system. The User entity is global; the role is contextual. A single human user can hold the Commercial Owner persona on one project, Section Lead on another, and Privacy Reviewer on a third.

---

## Commercial Owner

The accountable individual for a product attestation. Typically the business sponsor, business owner, or product manager.

**Responsibilities**
- Drafts the project, lists target jurisdictions and scope_type.
- Ensures questions are answered, personally or by delegation.
- Reviews AI pre-populated answers and either accepts or edits them.
- Responds to Reviewer Clarifications.
- Attests to the truthfulness of all answers.

**Authority**
- Exactly one Commercial Owner per project.
- Cannot delegate ultimate accountability — every answer carries their attestation regardless of who authored it.
- Can invite Section Leads and Question Collaborators.
- Can submit a Section for Section Release; can submit the Project.

**Naming note**
Considered "Product Owner" but rejected — that term is heavily overloaded in agile/scrum contexts and means something specific (backlog management) that has nothing to do with this role. "Commercial Owner" points at business accountability, which is the right framing.

---

## Collaborator

Umbrella term for a subject-matter contributor invited to answer questions. Has intimate knowledge of one slice of the product but is not accountable for the overall attestation. Two authorization levels:

### Section Lead

A Collaborator granted authority over an entire section of the questionnaire (e.g., Security, AI/ML, Data residency).

**Responsibilities**
- Answers any question in the section.
- May further delegate individual questions to Question Collaborators.
- Marks the section as ready for Section Release.

**Authority**
- One Section Lead per section maximum, per project.
- Has `delegate_authority = true`.
- Cannot submit the Project — only the Commercial Owner can.

### Question Collaborator

A Collaborator granted authority over one or more specific questions, but not a whole section.

**Responsibilities**
- Answers assigned questions.
- Comments on assigned questions.

**Authority**
- Multiple per project.
- Has `delegate_authority = false` — cannot further delegate.
- Cannot mark sections as ready.

---

## Reviewer

Umbrella term for a risk-domain expert who evaluates a Released Section or a Submitted Project from a specific lens.

**Responsibilities (all Reviewer types)**
- Read the relevant Answers, DocExtractions, RepoFindings, and Discrepancies.
- Open Clarifications on Answers that are unclear or insufficient.
- Mark Discrepancies as acknowledged, warranting follow-up, or no action.
- Issue a Disposition (approve, conditional, reject) on their Review once no Clarifications are open.

**Authority**
- Cannot edit Answers directly. Editing rights flow to the Commercial Owner via Clarifications.
- Cannot speak for other Reviewer domains. Their Disposition covers their domain only.
- Their Disposition is final for their domain absent re-review triggered by a delta change.

The five Reviewer types:

### Jurisdictional Reviewer

Legal or risk expert scoped to a specific country or region (UK&I, MENA, JPN/ASEAN/Korea, US-LATAM-Israel, EUWest, EUCentral, GreaterChina, India-Africa, Oceania, Canada).

Evaluates privacy law, jurisdictional tax issues, local brand reputation, country-specific regulations, and any local increments to global EY policy. A project targeting three countries gets three Jurisdictional Reviewers.

### Independence Reviewer

Firm-wide expert on EY's independence rules. Evaluates whether the product creates independence conflicts (e.g., the Channel One audit-client example, BRIDGE-relevant vendor relationships, "auditing one's own work" patterns). Typically one per project regardless of jurisdiction count, with country increments handled via Jurisdictional Reviewers.

### Privacy Reviewer

Data protection expert. Evaluates data classification (C1/C2/C3/C4), data residency, retention, subject rights handling, PIA compliance, and DSO data risk. Often overlaps with Jurisdictional Reviewer for regional regimes like GDPR.

### Brand Reviewer

Evaluates reputational risk: how the product is named, marketed, and positioned. Single per project. Works closely with the BMC team supporting the sponsor.

### Security Reviewer

Evaluates whether technical security controls match the data sensitivity (e.g., C4 → 2FA + encryption at rest and in transit). Reads both attested answers and objective Repo Findings. Coordinates with InfoSec certification, Supplier Risk Assurance, and the InfoSec exception process where applicable.

---

## Question Author

A legal, risk, or independence professional who maintains the question corpus, the policy documents, the dependency graph, and the fast-track Patterns.

**Responsibilities**
- Creates and edits Questions (creating new QuestionVersions on edit; old versions remain immutable).
- Edits the Question Dependency DAG.
- Creates and edits Patterns and PatternVersions.
- Uploads PolicyDocs and PolicyVersions.
- Retires Questions and Patterns when no longer applicable.

**Authority**
- Has `is_question_author = true` in `User.global_roles`.
- Cannot retroactively change historical attestations — version pinning ensures past Answers, Patterns, and Policies remain coherent.
- Distinct workflow from Reviewer. Some individuals will hold both personas; the workflows are separate.

**Naming note**
Considered "Policy Author" but a Question Author owns more than policies — they own questions, dependencies, and patterns. "Question Author" is slightly narrow but it's the most concrete description of what they do day-to-day.

---

## System

The AI-driven actor. Worth naming because it does real work and is referenced as a participant in the audit log.

**Responsibilities**
- Pre-populates Answers from Documents and Repo with `source = system_inferred`, citation, and confidence.
- Generates DocExtractions from ingested Documents.
- Produces RepoFindings from ingested GitHub repositories.
- Computes PatternMatches continuously as Answers come in.
- Flags Discrepancies between owner-attested Answers and system-inferred values.

**Authority**
- Never accountable — its outputs are either accepted by a human or persist as objective evidence.
- Has its own column in the audit log to distinguish AI-inferred from owner-attested from reviewer-flagged actions.
- Cannot issue a Disposition.
- Cannot mark a Section ready for Release.
- Cannot resolve a Clarification.

---

## Persona overlap

A single human user can hold multiple personas across different projects:
- Commercial Owner on Project A
- Section Lead on Project B
- Privacy Reviewer on Project C
- Question Author globally

The User entity is global. The role is contextual to the Project.

---

## Authority matrix

| Action | Commercial Owner | Section Lead | Question Collaborator | Reviewer | Question Author | System |
|---|---|---|---|---|---|---|
| Create Project | ✓ | | | | | |
| Edit Project metadata | ✓ | | | | | |
| Answer foundational questions | ✓ | | | | | ✓ (proposes) |
| Answer section questions | ✓ | ✓ | ✓ (assigned only) | | | ✓ (proposes) |
| Delegate section | ✓ | | | | | |
| Delegate question (within section) | ✓ | ✓ | | | | |
| Mark section ready for Release | ✓ | ✓ | | | | |
| Submit Project | ✓ | | | | | |
| Open Clarification | | | | ✓ | | |
| Edit Answer in Clarification | ✓ | ✓ (if section-scoped) | ✓ (if question-scoped) | | | |
| Issue Disposition | | | | ✓ | | |
| Mark Discrepancy | | | | ✓ | | ✓ (initial flag only) |
| Create/edit Question | | | | | ✓ | |
| Create/edit Pattern | | | | | ✓ | |
| Upload PolicyDoc | | | | | ✓ | |
| Pre-populate Answer | | | | | | ✓ |
| Generate DocExtraction | | | | | | ✓ |
| Produce RepoFinding | | | | | | ✓ |
| Compute PatternMatch | | | | | | ✓ |
