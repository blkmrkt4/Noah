/**
 * Seeds realistic reviewer ↔ commercial owner conversation flow
 * on the Triage & Routing section of the "Test Review Flow" project.
 *
 * Creates: answers, a reviewer, a review, threads, comments, clarifications.
 * Safe to re-run — skips if review already exists.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function getPostgresUrl(): string {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("prisma+postgres")) {
    const apiKey = new URL(url.replace("prisma+postgres", "http")).searchParams.get("api_key");
    if (apiKey) {
      return JSON.parse(Buffer.from(apiKey, "base64").toString()).databaseUrl;
    }
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: getPostgresUrl() });
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function main() {
  console.log("🎭 Seeding review conversation flow...\n");

  // ── Get existing entities ─────────────────────────────────────────────
  const project = await prisma.project.findFirst({ where: { name: "Test Review Flow" } });
  if (!project) throw new Error("Project 'Test Review Flow' not found");

  const section = await prisma.section.findUnique({ where: { slug: "triage" } });
  if (!section) throw new Error("Triage section not found");

  const owner = await prisma.user.findUnique({ where: { id: project.commercialOwnerId } });
  if (!owner) throw new Error("Commercial owner not found");

  const reviewerUser = await prisma.user.findFirst({ where: { email: "reviewer@ey.com" } });
  if (!reviewerUser) throw new Error("Reviewer user not found");

  // Check if we already seeded
  const existingReview = await prisma.review.findFirst({
    where: { projectId: project.id, sectionId: section.id },
  });
  if (existingReview) {
    console.log("⏭  Review flow already seeded — skipping.");
    return;
  }

  // ── Create reviewer role ──────────────────────────────────────────────
  const reviewer = await prisma.reviewer.create({
    data: {
      userId: reviewerUser.id,
      domain: "privacy",
      jurisdictions: ["UK", "US"],
    },
  });
  console.log("✓ Created reviewer:", reviewerUser.name, "(privacy)");

  // ── Get triage questions ──────────────────────────────────────────────
  const questions = await prisma.question.findMany({
    where: { sectionId: section.id },
    include: { versions: { orderBy: { version: "desc" as const }, take: 1 } },
    orderBy: { slug: "asc" },
  });

  // ── Seed answers for each question ────────────────────────────────────
  const answerValues: Record<string, { value: unknown; source: "owner_attested" | "system_inferred" }> = {
    "triage.accessibility_required": { value: false, source: "owner_attested" },
    "triage.aiqrm_required": { value: false, source: "owner_attested" },
    "triage.aira_required": { value: true, source: "system_inferred" },
    "triage.applicable_jurisdictional_reviewers": { value: ["UK", "US"], source: "owner_attested" },
    "triage.bia_required": { value: false, source: "owner_attested" },
    "triage.brand_path": { value: "standard", source: "owner_attested" },
    "triage.bridge_required": { value: false, source: "system_inferred" },
    "triage.contracts_review_required": { value: true, source: "owner_attested" },
    "triage.dso_lane": { value: "lane_2", source: "owner_attested" },
    "triage.fast_track_eligible": { value: false, source: "system_inferred" },
    "triage.independence_required": { value: true, source: "system_inferred" },
    "triage.nss_path": { value: "not_applicable", source: "owner_attested" },
    "triage.oss_path": { value: "internal_only", source: "owner_attested" },
    "triage.privacy_required": { value: true, source: "owner_attested" },
  };

  const answers: { slug: string; answerId: string }[] = [];

  for (const q of questions) {
    const qv = q.versions[0];
    if (!qv) continue;
    const av = answerValues[q.slug] ?? { value: "unknown", source: "owner_attested" as const };

    const answer = await prisma.answer.create({
      data: {
        projectId: project.id,
        questionVersionId: qv.id,
        value: av.value as any,
        source: av.source,
        aiConfidence: av.source === "system_inferred" ? 0.82 : null,
        attestedBy: av.source === "owner_attested" ? owner.id : null,
        answeredAt: hoursAgo(72),
      },
    });
    answers.push({ slug: q.slug, answerId: answer.id });
  }
  console.log(`✓ Created ${answers.length} answers`);

  // ── Create the review ─────────────────────────────────────────────────
  const review = await prisma.review.create({
    data: {
      projectId: project.id,
      sectionId: section.id,
      reviewerId: reviewer.id,
      domain: "privacy",
      status: "in_progress",
      isCriticalPath: true,
      openedAt: hoursAgo(48),
      lastViewedAt: hoursAgo(2),
    },
  });
  console.log("✓ Created review (privacy, in_progress)");

  // ── Update section state ──────────────────────────────────────────────
  await prisma.sectionState.update({
    where: { projectId_sectionId: { projectId: project.id, sectionId: section.id } },
    data: { state: "under_review", releasedAt: hoursAgo(50) },
  });

  // ── Conversation scripts ──────────────────────────────────────────────
  // Each entry: question slug, thread type, comments back and forth

  const conversations: {
    slug: string;
    type: "comment" | "clarification";
    exchanges: { author: "reviewer" | "owner"; body: string; hoursAgo: number }[];
    clarificationResolved?: boolean;
  }[] = [
    {
      slug: "triage.privacy_required",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "Confirmed — PIA will be required given the data classification. Have you started the PIA process yet?", hoursAgo: 44 },
        { author: "owner", body: "Yes, we've engaged the privacy team. Draft PIA is in progress and should be ready for review next week.", hoursAgo: 40 },
        { author: "reviewer", body: "Good. Please share the draft once available — I'll need to cross-reference against the data residency answers.", hoursAgo: 38 },
      ],
    },
    {
      slug: "triage.aira_required",
      type: "clarification",
      exchanges: [
        { author: "reviewer", body: "The system inferred AIRA is required at 82% confidence. Can you confirm whether the product uses any ML models for decision-making that affects clients?", hoursAgo: 46 },
        { author: "owner", body: "Yes — we use a classification model to categorize tax scenarios. It doesn't make final decisions but it does influence which review path a case takes.", hoursAgo: 42 },
        { author: "reviewer", body: "That's enough to trigger AIRA. The fact that it influences routing means it has a material effect on outcomes. I'll mark this confirmed.", hoursAgo: 39 },
      ],
      clarificationResolved: true,
    },
    {
      slug: "triage.dso_lane",
      type: "clarification",
      exchanges: [
        { author: "reviewer", body: "You selected Lane 2 but the data classification from intake suggests C3 data. Lane 2 is typically for C1/C2. Can you clarify why Lane 2 was chosen?", hoursAgo: 45 },
        { author: "owner", body: "The C3 classification is for a small subset of records — client tax IDs used during the matching step. The bulk of the data is C2 aggregate analytics. We chose Lane 2 based on the predominant classification.", hoursAgo: 41 },
        { author: "reviewer", body: "Understood, but EY policy is to classify based on the highest sensitivity present, not the predominant one. This should be Lane 3. Please update.", hoursAgo: 37 },
        { author: "owner", body: "Fair point — I've updated the answer to Lane 3. Thanks for catching that.", hoursAgo: 35 },
      ],
      clarificationResolved: true,
    },
    {
      slug: "triage.independence_required",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "System flagged independence review required. Given the product touches audit-adjacent data, this is correct. I've noted it for the independence reviewer.", hoursAgo: 43 },
        { author: "owner", body: "Acknowledged. We've already had a preliminary conversation with the independence team — they're aware.", hoursAgo: 36 },
      ],
    },
    {
      slug: "triage.applicable_jurisdictional_reviewers",
      type: "clarification",
      exchanges: [
        { author: "reviewer", body: "You listed UK and US but the intake shows the product will also be deployed in Germany. Should DE be added to the jurisdictional reviewer list?", hoursAgo: 44 },
        { author: "owner", body: "Good catch — Germany was added after the initial intake. Yes, DE should be included. I'll update the answer.", hoursAgo: 38 },
      ],
      clarificationResolved: false, // still open
    },
    {
      slug: "triage.fast_track_eligible",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "Fast-track ineligible is correct — the AIRA trigger and C3 data classification both disqualify this from the expedited path.", hoursAgo: 42 },
      ],
    },
    {
      slug: "triage.contracts_review_required",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "Contracts review will be needed for the third-party data provider agreement. Is the SOW finalized?", hoursAgo: 40 },
        { author: "owner", body: "SOW is in draft. Legal is reviewing the indemnification clauses. Expected to finalize by end of month.", hoursAgo: 34 },
        { author: "reviewer", body: "Please flag if there are any data processing clauses — those will need privacy review as well.", hoursAgo: 30 },
        { author: "owner", body: "Will do. There's a data processing addendum (DPA) that I'll route to you once legal signs off on the main terms.", hoursAgo: 26 },
      ],
    },
    {
      slug: "triage.bridge_required",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "System inferred no BRIDGE requirement. Agreed — no vendor relationships flagged in the intake that would trigger BRIDGE.", hoursAgo: 41 },
      ],
    },
    {
      slug: "triage.oss_path",
      type: "comment",
      exchanges: [
        { author: "reviewer", body: "Internal-only OSS path noted. The repo scan didn't flag any copyleft licenses. Looks clean.", hoursAgo: 39 },
        { author: "owner", body: "Correct — all dependencies are MIT or Apache 2.0. We have a policy of avoiding GPL in client-facing products.", hoursAgo: 33 },
      ],
    },
    {
      slug: "triage.brand_path",
      type: "clarification",
      exchanges: [
        { author: "reviewer", body: "You marked 'standard' brand path but the product name 'TaxHacker' could raise brand concerns — the word 'hacker' has negative connotations in a professional services context. Has BMC reviewed the name?", hoursAgo: 43 },
        { author: "owner", body: "That's actually the internal code name, not the market-facing name. The external name will go through BMC before launch. Should I note that here?", hoursAgo: 37 },
        { author: "reviewer", body: "Yes, please add a note clarifying it's a working title. And I'd recommend upgrading to 'enhanced' brand path given the naming question — BMC will want to weigh in formally.", hoursAgo: 32 },
      ],
      clarificationResolved: false,
    },
  ];

  let threadCount = 0;
  let commentCount = 0;
  let clarificationCount = 0;

  for (const conv of conversations) {
    const answerEntry = answers.find((a) => a.slug === conv.slug);
    if (!answerEntry) continue;

    if (conv.type === "clarification") {
      // Create clarification on the review
      const clarification = await prisma.clarification.create({
        data: {
          reviewId: review.id,
          answerId: answerEntry.answerId,
          status: conv.clarificationResolved ? "resolved" : "open",
          openedAt: hoursAgo(conv.exchanges[0].hoursAgo),
          resolvedAt: conv.clarificationResolved ? hoursAgo(conv.exchanges[conv.exchanges.length - 1].hoursAgo - 1) : null,
        },
      });
      clarificationCount++;

      // Thread on the clarification
      const thread = await prisma.thread.create({
        data: {
          parentType: "clarification",
          clarificationId: clarification.id,
          status: conv.clarificationResolved ? "closed" : "open",
        },
      });
      threadCount++;

      for (const ex of conv.exchanges) {
        await prisma.comment.create({
          data: {
            threadId: thread.id,
            authorId: ex.author === "reviewer" ? reviewerUser.id : owner.id,
            authorKind: "user",
            body: ex.body,
            createdAt: hoursAgo(ex.hoursAgo),
          },
        });
        commentCount++;
      }
    } else {
      // Regular comment thread on the answer
      const thread = await prisma.thread.create({
        data: {
          parentType: "answer",
          answerId: answerEntry.answerId,
          status: "open",
        },
      });
      threadCount++;

      for (const ex of conv.exchanges) {
        await prisma.comment.create({
          data: {
            threadId: thread.id,
            authorId: ex.author === "reviewer" ? reviewerUser.id : owner.id,
            authorKind: "user",
            body: ex.body,
            createdAt: hoursAgo(ex.hoursAgo),
          },
        });
        commentCount++;
      }
    }
  }

  console.log(`✓ Created ${threadCount} threads, ${commentCount} comments, ${clarificationCount} clarifications`);
  console.log("\n✅ Review conversation flow seeded on 'Test Review Flow' → Triage & Routing");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
