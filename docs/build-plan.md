# ARC Build Plan

> **Load when:** picking up new work and need to know what's already built vs. what's still open, or when you hit a design question and want to check whether it's deliberately unsettled vs. a real decision to make.

This file holds the build status and the list of design questions that are deliberately open. It complements `CLAUDE.md` (always-on conventions and routing) and `prd.md` (product vision and scope).

## Status — Phases 1-6 merged

Commit `84c28b2 ARC Phase 1-6: Full risk attestation system` brought the structural skeleton end-to-end. What's in the repo today:

### Phase 1 — schema and corpus ingestion

- Prisma schema implementing `data-model.md` entities (`prisma/schema.prisma`, generated client at `src/generated/prisma/`).
- YAML corpus loader (`scripts/seed-corpus.ts`) reading `docs/questions/_schema.yaml`, every section file, `_sections.yaml`, `_patterns.yaml`, and `QuestionDependency` rows from each question's `activates_when` block.
- PolicyDoc loading from a `docs/policies/` directory is **not yet wired** — see open items below.

### Phase 2 — questionnaire backend

- Project creation, foundational answer flow, dependency-driven activation (`/api/projects`, `/api/projects/[id]/answers`).
- Document upload + ingestion → DocExtractions (`/api/projects/[id]/documents`, `/api/projects/[id]/documents/upload`).
- GitHub repo ingestion → RepoFindings (`/api/projects/[id]/repo`, `src/lib/repo-scanner.ts`).
- AI pre-population producing `system_inferred` Answers with citations (`/api/projects/[id]/ingest`, `src/lib/ingestion.ts`).
- Owner attestation flow with Discrepancy logging on edit.
- Section state machine (Drafting → Released → Under Review → Cleared) (`/api/projects/[id]/sections/[sectionId]`, `/api/projects/[id]/state`).

### Phase 3 — review backend

- Review opening on Section Release / Project Submission (`/api/projects/[id]/reviews`, `/api/reviews/[reviewId]`).
- Clarification flow with `in_clarification` flag (`/api/reviews/[reviewId]/clarifications`, `/api/clarifications/[clarificationId]`).
- Disposition issuance and Project Disposition computation (`/api/projects/[id]/submit`).
- PolicySnapshot pinning at Project Submission.

### Phase 4 — pattern matching

- Continuous PatternMatch evaluation as Answers change.
- Fast-track determination at Project Submission via `reviewer_waivers`.

### Phase 5 — collaboration and notifications

- Section Lead and Question Collaborator delegation (`/api/projects/[id]/delegations`).
- Threaded discussion on Answer / Review / Clarification / Delegation (`/api/threads/[threadId]/comments`, `/api/projects/[id]/answers/[answerId]/thread`).
- Notification batching with `digest_payload` (`/api/notifications`).
- Urgent-override for terminal events.

### Phase 6 — UI

- Commercial Owner workspace: dashboard (`/`), projects list (`/projects`), project create (`/projects/new`), project hub (`/projects/[id]`), questionnaire (`/projects/[id]/questionnaire`).
- Reviewer workspace (`/projects/[id]/review`).
- Corpus reference (`/corpus`).
- Admin (`/admin`, `/admin/models`, `/admin/prompts`, `/admin/settings`).

## What's still open — fill-in and refinement

Visible gaps in the merged build. None of these are phase work; each is a small, scoped fix.

1. **Brand mark not wired.** The sidebar uses a typographic "EY" instead of the SVG primary mark. The supplied SVGs are colored for light backgrounds (off-black wordmark) so they don't render correctly on the dark sidebar — a reverse-colorway asset or a local recolor is needed before this can be wired. See `design/components/icon-rail.md`.
2. **Sidebar ≠ icon-rail spec.** Implementation is a static 240px sidebar; spec describes a 56px collapsed / 240px expanded rail with hover-expand, pin button, instant tooltips, badges. Decide whether to rewrite Sidebar to spec or update the spec to match what shipped.
3. **Empty-state SVGs unused.** `design/assets/empty-queue.svg`, `empty-search.svg`, `empty-submissions.svg` are not referenced anywhere in `src/`.
4. **Typography unsettled.** `globals.css` declares `font-family: "EYInterstate", Arial, ...` but no font files are shipped, so the cascade falls to Arial. `next/font` loads Geist into CSS variables but globals overrides it. Pick one and align.
5. **Warning amber missing.** `design/design.md` reserves `#FFC107` as warning amber (after losing the accent slot to `#FFE600`), but no `--warning-amber` token exists in `globals.css`.
6. **PolicyDoc loader.** Phase 1 spec called for loading from `docs/policies/`; not yet wired.
7. **Corpus depth.** Section YAMLs ship the structural skeleton plus the highest-leverage questions; deeper question sets (e.g., AIRA's full ~50 questions) are explicitly Policy Author work, not Claude work.
8. **Project name in design system.** `design/design.md` still refers to the project as "Noah2"; the product is "EY ARC" everywhere else.

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
