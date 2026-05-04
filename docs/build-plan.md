# ARC Build Plan

> **Load when:** starting new work and need to know which phase to pick up, or when you hit a design question and want to check whether it's deliberately unsettled vs. a real decision to make.

This file holds the phase-by-phase build plan and the list of design questions that are deliberately open. It complements `CLAUDE.md` (always-on conventions and routing) and `prd.md` (product vision and scope).

## What to build first

### Phase 1 — schema and corpus ingestion (no UI)

1. Implement the data model from `data-model.md` exactly. Migrations for every entity.
2. Implement the YAML question corpus loader. It should:
   - Read `questions/_schema.yaml` to validate every question file.
   - Load each section file, creating Question + QuestionVersion rows.
   - Load QuestionDependency rows from each question's `activates_when` block.
   - Load Section rows from a `_sections.yaml` registry (you'll need to create this).
3. Implement Pattern loading from `questions/_patterns.yaml` (you'll need to create this — V1 ships with the four Patterns named in `prd.md` § 9).
4. Implement PolicyDoc loading from a `policies/` directory (out of scope for the spec phase but in scope for the build).

### Phase 2 — questionnaire backend

5. Project creation, foundational answer flow, dependency-driven activation.
6. Document upload, ingestion pipeline producing DocExtractions.
7. GitHub repo ingestion producing RepoFindings.
8. AI pre-population producing system_inferred Answers with citations.
9. Owner attestation flow (accept / edit, Discrepancy logging on edit).
10. Section state machine (Drafting → Released → Under Review → Cleared).

### Phase 3 — review backend

11. Review opening on Section Release / Project Submission.
12. Clarification flow (open → in_clarification flag flips on Answer → Responded → Resolved).
13. Disposition issuance and Project Disposition computation.
14. PolicySnapshot pinning at Project Submission.

### Phase 4 — pattern matching

15. Continuous PatternMatch evaluation as Answers change.
16. Fast-track determination at Project Submission via reviewer_waivers.

### Phase 5 — collaboration and notifications

17. Delegation (Section Lead, Question Collaborator) with appropriate authority levels.
18. Threaded discussion on Answer / Review / Clarification / Delegation.
19. Notification batching with digest_payload.
20. Urgent-override for terminal events.

### Phase 6 — UI

21. Commercial Owner project workspace (foundational → triage → sections).
22. Reviewer review workspace (per-Section, per-domain).
23. Question Author corpus authoring tool.
24. Admin / Question Author Pattern editor.

## Things that are deliberately unsettled

These are not your problem to solve unilaterally. If you reach one of these, stop and ask Robin.

1. **Recursive collaboration depth.** Question Collaborators currently can't further delegate. May change. (`prd.md` § 15.1, `data-model.md` open Q1)

2. **Policy retroactivity for in-flight projects.** When a policy updates while a project is in Drafting, what happens? (`prd.md` § 15.2, `data-model.md` open Q2)

3. **Clarification re-review scope.** When a Clarification reopens an Answer in a Cleared Section, does the SectionState revert for all Reviewers or just the relevant one? Recommended: just the relevant one. (`prd.md` § 15.3, `data-model.md` open Q3)

4. **GitHub re-scan policy.** Latest commit, diff against last submission, or all findings ever? (`prd.md` § 15.4, `data-model.md` open Q7)

5. **Cross-cutting Reviews and section_id null.** Acceptable, or introduce a synthetic "whole project" Section? (`prd.md` § 15.5, `data-model.md` open Q8)

6. **Pattern slug stability.** Patterns reference questions by slug. No automatic check that slugs preserve meaning. (`prd.md` § 15.6, `data-model.md` open Q4)

7. **Per-project explicit roles vs. derived.** No ProjectMembership table currently. May need one for read-only access or co-ownership. (`prd.md` § 15.7, `data-model.md` open Q5)

8. **NotificationPreference.** Per-user settings not yet modeled. (`prd.md` § 15.8, `data-model.md` open Q6)

9. **Dedicated AI Reviewer type vs. routing through Privacy + Security.** EY's existing AIRA/AIQRM model routes through Privacy and Security. ARC currently follows that. Should AI become its own Reviewer domain? (`risk-domains.md` § AI)

10. **Dedicated Contracts Reviewer vs. absorbed into Independence.** Currently in the data model as `domain = contracts`. Confirm whether this should be separate or merged. (`risk-domains.md` § Contracts)

11. **Dedicated BIA Reviewer vs. routed via Security.** EY runs BIA via Business Continuity. (`risk-domains.md` § BIA)

12. **Service-line overlay engagement model.** The corpus captures the questions; the Reviewer engagement path with service-line CTOs is not fully designed. (`risk-domains.md` § Service-line overlays)
