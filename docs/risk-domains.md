# ARC Risk Domains

> **Load when:** working on triage logic, reviewer assignment, section activation rules, or routing more broadly. Skip when working in a single section's domain or on infrastructure that doesn't care about routing.

This file describes each risk domain ARC routes to. For each domain, we capture:

- **What it reviews** — the substantive scope.
- **Reviewer type** — which of the five Reviewer types (Jurisdictional, Independence, Privacy, Brand, InfoSec) handles this domain.
- **Triggering questions** — which foundational/triage answers activate this domain's questions.
- **Section in the corpus** — the YAML file in `questions/` that holds its questions.
- **Underlying EY function** — the human/process this domain represents.
- **Evidence required** — what Reviewers will need to read to issue a Disposition.
- **Possible Dispositions** — approve / conditional / reject; with notes on when each is typical.

Cross-cutting domains (Independence, Brand) attach to the Project as a whole. Section-scoped domains attach to a specific Section; the Section is the unit of Release.

---

## Privacy & Data Protection

**What it reviews**
Whether the product processes personal data, client data, or third-party licensed data; cross-border transfer paths; data residency; retention; subject rights handling; consent mechanisms; PIA obligations; DSO data risk classification.

**Reviewer type**
Privacy Reviewer (firm-level baseline); Jurisdictional Reviewer (regional regimes — GDPR/UK GDPR, US state laws, LGPD, PIPL, India DPDP, etc.).

**Triggering questions**
- `data.types.includes_personal_data = true`
- `data.types.includes_client_information = true`
- `data.crossborder.transfer_paths != []`
- `ai.exists = true` (triggers DSO data risk overlay)

**Section in the corpus**
`questions/privacy.yaml`

**Underlying EY function**
EY Global PIA Procedure; Personal Data Protection Global Policy; Data Protection community; Data Protection by Design and Default; ROPA (Germany).

**Evidence required**
- Data inventory: fields, sources, classifications.
- Data flow diagrams (often pulled from DocExtractions).
- Cross-border transfer mechanism (SCCs, adequacy, BCRs, localization).
- Retention schedule.
- Data subject rights handling.
- Consent and CIC documentation where applicable.

**Possible Dispositions**
- *Approve* — privacy obligations clearly addressed; PIA complete; no high-risk processing.
- *Conditional* — approve subject to specific remediations (e.g., add SCC for a transfer path, complete a DPIA for a high-risk processing).
- *Reject* — fundamental incompatibility (e.g., processing prohibited under EU AI Act, no lawful basis, localization breach).

---

## AI (AIRA + AIQRM)

**What it reviews**
Whether the product contains AI; what kind (predictive, generative, agentic, multi-agent); regulatory tier under EU AI Act and equivalents; provider vs deployer role; lifecycle stage; testing evidence; monitoring plans; periodic review cadence; and whether it qualifies for green-lane via DSO data risk criteria.

**Reviewer type**
Privacy Reviewer (DSO data risk overlay) + InfoSec Reviewer (AI Assessment) + a dedicated AI review path that, in V1, is treated as a sub-domain of Privacy and InfoSec based on EY's framework structure. Claude Code: see open question on whether to introduce a dedicated `AI Reviewer` type or keep it routed through Privacy and InfoSec as it is in EY's existing AIRA/AIQRM model.

**Triggering questions**
- `ai.exists = true`

**Section in the corpus**
`questions/ai.yaml` — covers AIRA classification, AIQRM, DSO data risk, AI agent governance, third-party model considerations.

**Underlying EY function**
EY AI Agent Development Framework v1.5.1 (mandatory global standard); AIRA classification; AIQRM quality risk management; DSO green-lane / yellow-lane data risk check.

**Evidence required**
- AIRA classification result (regulatory tier, role, business impact).
- Model documentation (provider, version, training data provenance for in-house models).
- Validation and testing evidence.
- Monitoring plan.
- Use-case description and intended purpose.
- Data classification and rights for training, grounding, and inference data.

**Possible Dispositions**
- *Approve* — green-lane eligible or fully validated yellow-lane case.
- *Conditional* — approve subject to AIQRM action items, monitoring plan, or periodic review cadence.
- *Reject* — prohibited AI use case under EU AI Act (e.g., workplace emotion recognition); fundamental data rights gap.

---

## Independence

**What it reviews**
Whether the product creates independence conflicts. Three core patterns: auditing one's own work, acting as management, and advocacy. Includes BRIDGE for vendor relationships. Covers audit clients, restricted entities, and any country-specific independence increments.

**Reviewer type**
Independence Reviewer (firm-level); Jurisdictional Reviewer applies country increments where present.

**Cross-cutting**: this Review attaches to the Project as a whole, not to a specific Section.

**Triggering questions**
- `client.is_audit_client = true` or `client.is_restricted_entity = true`
- `vendor.has_third_party_relationship = true` (BRIDGE trigger)
- `service.touches_financial_systems = true` (own-work trigger)

**Section in the corpus**
`questions/independence.yaml`

**Underlying EY function**
EYG Independence Policy; BRIDGE; GIS / GMS; SORT; country-specific independence increments.

**Evidence required**
- GIS/GMS lookup result for the client and affiliates.
- BRIDGE record for any third-party relationships.
- Service description sufficient to assess own-work, management-acting, advocacy patterns.
- SORT classification of the services delivered via the tool.

**Possible Dispositions**
- *Approve* — no independence conflicts identified.
- *Conditional* — approve excluding specific client types or specific service models; require BRIDGE completion.
- *Reject* — fundamental independence breach for the proposed deployment scope.

---

## InfoSec (incl. SRA)

**What it reviews**
Whether technical security controls match data sensitivity. Includes intrinsic risk rating, mandatory controls by risk class, vulnerability testing, security certification, supplier risk for vendors and cloud providers, and any required security exceptions.

**Reviewer type**
InfoSec Reviewer (firm-level); reads both attested answers and RepoFindings.

**Triggering questions**
- Always activates (every project that handles EY information is in scope per the Global Information Security Policy).
- Vendor and cloud questions activate SRA branch.
- AI questions activate the InfoSec AI Assessment branch.

**Section in the corpus**
`questions/security.yaml` — covers InfoSec assessment, Security Certification, Supplier Risk Assurance.

**Underlying EY function**
EY Global Information Security Policy (Code of Connection); Information Security Program Management Framework (ISMS).

**Evidence required**
- Intrinsic risk rating (high / moderate / low).
- Architecture and data flow.
- Authentication, encryption, and access control posture.
- Vulnerability test results and remediation status.
- Supplier list with SRA status for each.
- RepoFindings (objective code-level evidence).
- Any security exceptions with risk acknowledgement.

**Possible Dispositions**
- *Approve* — controls match risk rating; certification obtained.
- *Conditional* — approve with named remediations, exception process, or limited deployment scope.
- *Reject* — controls fundamentally inadequate for the data sensitivity.

---

## Brand, Naming, Accessibility, UX

**What it reviews**
Reputational risk: how the product is named, marketed, positioned, and presented. Includes Naming review, brand identity, UX standards, Motif Design System usage, and digital accessibility (WCAG 2.1 AA).

**Reviewer type**
Brand Reviewer (single per project, firm-level).

**Cross-cutting**: this Review attaches to the Project as a whole.

**Triggering questions**
- Always activates for any branded / public-facing surface.
- Naming branch: `brand.name_visible_externally = true`.
- Accessibility branch: `audience.includes_external_users = true` or `audience.public = true`.

**Section in the corpus**
`questions/brand.yaml` — covers brand, naming, UX, Motif use.
`questions/accessibility.yaml` — covers WCAG 2.1 AA, accessibility testing engagement.

**Underlying EY function**
EY Branding (Digital Assets); EY UX Style Guide; EY Experience Design (XD); EY Digital Accessibility Global Policy; EY Accessibility Guidelines; SPSC Accessibility Testing Engagement Process; BMC.

**Evidence required**
- Proposed name, with rationale and any commercial/IP risk assessment.
- Screenshots of the UI (often from DocExtractions).
- WCAG 2.1 AA test results or planned remediation.
- BMC engagement status.

**Possible Dispositions**
- *Approve* — brand-compliant, name approved, accessibility met.
- *Conditional* — approve subject to name change, accessibility remediation, or UX adjustments.
- *Reject* — name conflicts with prior rightsholder; cannot meet accessibility threshold.

---

## Open Source Software (OSS)

**What it reviews**
Use of open source software components. License compatibility, attribution requirements, copyleft exposure, and component listing accuracy. Distinguishes standalone OSS/SaaS (faster path) from embedded OSS in EY-distributed code.

**Reviewer type**
Routed via InfoSec Reviewer (validation), Independence Reviewer (Independence Framework statements), and Contracts (GCO license review) where applicable. Architecture also engages.

**Triggering questions**
- `software.uses_oss = true`

**Section in the corpus**
`questions/oss.yaml`

**Underlying EY function**
EY OSS process; OSS Whitelist; MEND scanning; Independence Framework statements for OSS; GCO pre-approved license list.

**Evidence required**
- Component listing (packages, models, libraries with versions and licenses).
- MEND scan result.
- Independence Framework statements.
- License compatibility analysis.

**Possible Dispositions**
- *Approve* — fast-lane (whitelisted, pre-approved licenses, standalone).
- *Conditional* — approve with redistribution restrictions, attribution requirements, or SBOM publication.
- *Reject* — incompatible copyleft license; field-of-use restriction breach.

---

## Non-Standard Software (NSS)

**What it reviews**
Software not part of the standard approved route. Hinges on who is obtaining the license and what data types are shared, which determines downstream review engagement.

**Reviewer type**
Routed via InfoSec Reviewer (Security Consulting where required), Independence Reviewer (BRIDGE trigger), Contracts (GCO license review where EY is licensee), Privacy Reviewer (Data Protection where PII shared).

**Triggering questions**
- `software.is_non_standard = true`

**Section in the corpus**
`questions/nss.yaml`

**Underlying EY function**
NSS process; AUP (Acceptable Use Policy) for non-standard software; SCS zero-dollar threshold; BRIDGE.

**Evidence required**
- License acquisition party (EY, client, third party).
- Data types shared with the software.
- AUP attestation.
- BRIDGE record where applicable.

**Possible Dispositions**
- *Approve* — within AUP and approved data sharing scope.
- *Conditional* — approve with data restrictions or BRIDGE completion.
- *Reject* — fundamental risk in licensing party or data sharing.

---

## Contracts, IP, and Data Rights

**What it reviews**
Software ownership; transfer documentation; split ownership exposure between EY Global, Member Firms, vendors, and clients; client agreements that constrain reuse; data rights for each data source (owned, licensed, client-supplied, public, scraped); permitted purposes; geography and subprocessor restrictions.

**Reviewer type**
Routed via a dedicated Contracts/Legal channel (GCO) — in the data model, this is currently a Reviewer with `domain = contracts`. Claude Code: confirm whether this should be its own Reviewer type or absorbed into Independence Reviewer's scope.

**Triggering questions**
- Always activates (every project has at least an ownership question).
- `data.sources.includes_client_data = true` activates the rights-to-use branch.
- `software.created_with_external_party = true` activates the IP transfer branch.
- `data.sources.includes_third_party_licensed = true` activates the contract terms branch.

**Section in the corpus**
`questions/contracts.yaml`

**Underlying EY function**
GCO Contracts; Software Assets in the EY Network guidance; Knowledge Sharing Agreement context; Statement of Work guidance; CIC standard.

**Evidence required**
- Ownership documentation (assignments, SOW transfer, KSA, etc.).
- For each data source: rights to use for this purpose, in this geography, in this processing model.
- Contract clauses on AI training, cross-client reuse, subprocessing, support access.
- CIC status where applicable.

**Possible Dispositions**
- *Approve* — clear ownership, all data rights documented and within scope.
- *Conditional* — approve subject to contract amendment, CIC rollout, or scope restriction.
- *Reject* — fundamental rights gap; ownership cannot be cleanly resolved.

---

## Data Retention & Lifecycle

**What it reviews**
Retention schedule for each data type; ownership of deletion/archive decisions; legal hold mechanisms; logs vs business data separation; country- or client-specific deletion rules; post-production lifecycle (patching, retraining, country expansion, decommissioning).

**Reviewer type**
Privacy Reviewer (data retention regulatory aspects); InfoSec Reviewer (log retention security aspects).

**Triggering questions**
- Always activates.

**Section in the corpus**
`questions/retention.yaml`

**Underlying EY function**
Data Retention review category; legal discovery, regulatory compliance, and cybersecurity risk drivers.

**Evidence required**
- Retention schedule per data class.
- Deletion and archive ownership.
- Audit log of retention decisions.
- Post-production lifecycle plan.

**Possible Dispositions**
- *Approve* — schedule defined, ownership clear, lifecycle planned.
- *Conditional* — approve with retention schedule completion, lifecycle plan, or deletion automation.
- *Reject* — no defensible retention model.

---

## Business Impact Assessment (BIA)

**What it reviews**
Business criticality of the application and continuity/recovery requirements.

**Reviewer type**
Currently routed via InfoSec Reviewer in the V1 model; in EY today this is run by the Business Continuity team. Claude Code: confirm whether to introduce a dedicated BIA Reviewer type.

**Triggering questions**
- Always activates.

**Section in the corpus**
`questions/bia.yaml`

**Underlying EY function**
BIA process; BIA templates; BIA FAQ.

**Evidence required**
- Business criticality rating.
- Recovery time objective and recovery point objective.
- Continuity plan.

**Possible Dispositions**
- *Approve* — BIA complete, criticality understood.
- *Conditional* — approve with continuity plan completion.
- *Reject* — rare; only if criticality is incompatible with the architecture.

---

## Service-line overlays

**What it reviews**
Service-line-specific regulatory, professional, and operational requirements. Each EY service line (Tax, Assurance, Consulting, Strategy and Transactions, Sustainability, Clients & Industries) has overlay rules that apply to products supporting their work.

**Reviewer type**
Routed via the service line's own technology officer / risk function. In V1, captured in the corpus but engagement model with the service-line CTOs is through Independence Reviewer and Privacy Reviewer escalation paths.

**Triggering questions**
- `service.target_service_lines = [list]` — triggers overlay questions for each named service line.

**Section in the corpus**
`questions/service-lines.yaml`

**Underlying EY function**
Service-line CTO offices; service-line specific quality and risk management.

**Evidence required**
- Engagement scope, service-line-specific.
- Any service-line specific compliance requirements.

**Possible Dispositions**
- *Approve* — overlay requirements met.
- *Conditional* — approve with service-line-specific remediations.
- *Reject* — fundamentally incompatible with the service line's regulatory environment.

---

## Triggering matrix summary

The following compact matrix shows which sections activate based on a few foundational answers. Full activation rules live in the question YAML files.

| Foundational answer | Activates |
|---|---|
| `data.classification.highest_tier ∈ {C3, C4}` | Privacy (full PIA branch), InfoSec (elevated controls), Contracts (rights-to-use branch) |
| `data.types.includes_personal_data = true` | Privacy (full PIA branch + DPIA evaluation), AI (DSO data risk if AI present) |
| `data.crossborder.transfer_paths != []` | Privacy (cross-border transfer branch + each Jurisdictional Reviewer for transfer endpoints) |
| `ai.exists = true` | AI (AIRA + AIQRM), Privacy (DSO overlay), InfoSec (AI Assessment) |
| `client.is_audit_client = true` | Independence (audit-client permissibility branch) |
| `vendor.has_third_party_relationship = true` | Independence (BRIDGE branch), Contracts (vendor contract branch), InfoSec (SRA branch) |
| `software.uses_oss = true` | OSS (full branch) |
| `software.is_non_standard = true` | NSS (full branch) |
| `audience.includes_public = true` or `audience.includes_external_clients = true` | Brand, Accessibility, Privacy (additional) |
| `software.created_with_external_party = true` | Contracts (IP transfer branch) |
| `service.target_service_lines includes Assurance` | Service-lines overlay (Assurance specifics) |
| All projects | Intake, Triage, Security baseline, Contracts (ownership), Retention, BIA |
