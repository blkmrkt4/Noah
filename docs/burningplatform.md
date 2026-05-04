# The Burning Platform

This document exists because every other file in this directory describes *what* ARC is. None of them say *why we cannot keep doing what we are doing*. That's what this is for. If you are working on ARC and ever find yourself wondering whether a feature is worth the trouble, come back here.

---

## The number

**Nine months.** That is the average time it takes a piece of software produced inside Client Technology to get approved for deployment. And at the end of those nine months, it is typically approved by only a fraction of the countries it was originally intended for.

Read that twice. The product team scopes a global product. Nine months later, after sustained effort, they have approval for some subset of the markets they wanted. The remaining countries are still in some version of "we have a few questions." Some of those countries will eventually approve. Some will not. The team often does not find out which is which for months.

This is not an outlier project. This is the average.

## What those nine months actually look like

The Commercial Owner — the partner or business sponsor accountable for the product — does not spend nine months building. They spend nine months in a recurring conversation that goes like this:

A jurisdiction's risk team or legal practice schedules an interview or working session. The Commercial Owner walks them through the product. They answer questions. The session ends. There is no decision. There is no written record of what was actually concluded.

Two weeks later, an email arrives. The email contains either more questions or a soft signal: *"We're not sure we can move forward because..."* The reasons are often subjective. Sometimes the reasons reveal that an assumption from the working session was misunderstood. Sometimes they reveal that the reviewer has a country-specific concern that wasn't raised in the session. Sometimes they reveal that a different team in the same country was consulted offline and disagreed.

The Commercial Owner answers the email. They schedule the next working session. The cycle repeats.

Across a global product, this happens **20 to 100 times**. Per product. Each session is groundhog day — the same foundational facts about the product, restated to a new audience, with no shared memory of what was already established. The Commercial Owner cannot point the reviewer to a canonical record of what has been answered before, because no such record exists. The reviewer cannot see what other jurisdictions have already accepted, because that information is not collected anywhere.

The cost is not just calendar time. It is morale. Product teams burn out. Commercial Owners stop sponsoring new products because the cost of getting them approved is too high. Innovation slows. Good ideas die in the queue.

## Why every country is its own problem

Ten SuperRegions. Each with its own legal practice, its own risk team, its own regulators, and — crucially — its own *posture*. Some jurisdictions are aggressive about approving and pragmatic about residual risk. Others are cautious by training, by regulation, or by individual reviewer disposition. The same product, with the same answers, gets approved in three weeks in one country and stuck for six months in another. Not because the product is different. Because the *reviewer* is different.

This is not a problem ARC can solve by replacing reviewers. Reviewers are doing their job — protecting the firm and the client from real risk. Local legal practice is genuinely different across jurisdictions, and those differences are real. EU AI Act obligations are not US obligations. Brazil LGPD transfer rules are not India DPDP rules. China PIPL localization is not anything else.

What ARC can do is stop forcing the Commercial Owner to relitigate the *foundational* case in every country. The foundation — what the product does, what data it touches, who uses it, where it runs, what AI is involved, what the IP position is — is the same everywhere. Only the *country-specific overlay* legitimately differs. Today, the Commercial Owner re-explains the foundation in every conversation because there is no other way for the reviewer to get it. ARC's job is to make that re-explanation impossible to need.

## What we want the experience to be

The Commercial Owner makes their foundational case **once.** They answer questions inside the platform. The platform pre-populates as much as it can from the product's own documents and codebase, with citations. The owner attests, edits where needed, and submits.

Multiple reviewers — across multiple jurisdictions, across multiple risk domains — engage **in parallel**, against the same body of evidence. They each see the same foundational answers, the same uploaded documents, the same repo findings. They cannot ask the Commercial Owner to re-explain something already on the record. They can ask follow-up questions, but those follow-ups happen *inside the platform*, attached to specific answers, with a clear audit trail.

When a reviewer in Singapore digs deeper on AI training data provenance, that dig benefits **everyone**. The Commercial Owner answers once, in the platform, against the specific Clarification, and every other reviewer who looks at that question — now or later — sees the deeper answer. The follow-up rounds out the case for all jurisdictions, not just the one that asked.

This is the single most important property of ARC: **work done by any participant accrues to the shared body of evidence.** Not to one reviewer's notes. Not to one email thread. To the platform.

## Pulling everything back to the platform

The hardest part is not technical. The hardest part is behavioral. Today, conversations happen in:

- Working sessions (no record)
- Phone calls (no record)
- Hallway conversations (no record)
- Slack DMs (no record)
- Email threads (a record, but fragmented across inboxes, lost when people leave, never visible to other reviewers)

ARC has to be the place where the conversation lives. That means two things have to be true.

**First, answering inside ARC has to be easier than answering outside it.** If a reviewer emails the Commercial Owner with a question, it must be faster for the owner to log that question in ARC and respond there than to reply directly to the email. The platform has to be so frictionless that going outside it feels like extra work.

**Second, when conversations do leak outside the platform, there must be a deliberate path back in.** A reviewer sends an email. The Commercial Owner — or the reviewer — logs the email's question into ARC as a Clarification, responds inside the platform, and points the reviewer back to the platform for the answer. *"I've responded in ARC against question 4.3.2 — please continue the discussion there."* Each time this happens, the platform's gravitational pull strengthens. Reviewers learn that going to ARC first is faster than going to ARC second.

This is a deliberate product principle, not an accident: **outside-the-platform conversations end inside the platform.** Notifications, email integrations, and the Clarification workflow are designed to make this the path of least resistance.

## Ease of use is non-negotiable

ARC has two primary personas — Commercial Owner and Reviewer — and the experience for both has to be markedly easier than what they do today.

For the **Commercial Owner**: answering a question in ARC must take less time than answering the same question in a working session. AI pre-population, dependency-driven activation that hides irrelevant questions, the ability to delegate to Section Leads and Question Collaborators without losing accountability — all of this has to compose into something that feels like *less work* than the status quo. If the Commercial Owner ever thinks "this would be faster as an email," ARC has lost.

For the **Reviewer**: opening ARC must be faster than opening their inbox. They should see the projects assigned to them, the open Clarifications waiting for response, the sections cleared by their colleagues, the discrepancies the AI has flagged — at a glance, without hunting. The Disposition workflow should feel lighter than writing the same conclusion in an email. If the Reviewer ever thinks "I'll just send an email to the owner directly," ARC has lost.

Neither persona will tolerate a tool that makes their job harder than the broken status quo, no matter how much it helps the firm in aggregate. Ease of use is not polish. It is the thing that determines whether ARC succeeds or sits unused.

## What success looks like

If ARC works:

- Time from intake to first reviewer disposition drops from weeks to days.
- The Commercial Owner answers each foundational fact once, not 20 to 100 times.
- A reviewer in Frankfurt can read what a reviewer in Toronto already accepted, before scheduling a working session.
- An email asking a question results in a Clarification logged in ARC, not a fragmented thread.
- Country expansion from three markets to ten triggers a delta review against the existing body of evidence, not a fresh nine-month cycle.
- Patterns identify products that look like ones already approved, fast-tracking the obvious cases so reviewer attention concentrates where it matters.
- Product teams stop avoiding global ambitions because the approval cost is finally proportionate to the risk.

If ARC does not work, none of those things happen, and the firm continues to lose nine months per product to a process that has very little to do with actual risk and very much to do with the absence of a shared system of record.

## What this means for everyone building ARC

Every design decision should be tested against this question: *does this make the Commercial Owner's life easier, or does it make it harder?* If it makes their life harder, even by a small amount, the answer is almost always wrong — even if it is theoretically more correct, more flexible, or more elegant.

The same goes for reviewers. Every workflow has to feel like an upgrade over what they are doing in email today.

This is the bar. Nine months down to weeks. Twenty conversations down to one foundational case with parallel follow-ups. Email threads pulled back into the platform every time. The Commercial Owner saying, after their first project, *"that was actually fine."*

Anything less is not enough.
