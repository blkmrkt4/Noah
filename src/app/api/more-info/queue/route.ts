export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type QueueStatus =
  | "missing"
  | "question_stale"
  | "policy_stale"
  | "pending_review";

interface QueueItem {
  questionVersionId: string;
  questionId: string;
  questionSlug: string;
  questionPrompt: string;
  sectionSlug: string;
  sectionDisplayName: string;
  status: QueueStatus;
  existingMoreInfoId?: string;
  staleReason?: string;
}

/**
 * GET /api/more-info/queue
 *
 * Returns a "smart queue" of questions that need attention from the Policy
 * Author. Drives the Scans page — items appear here when a snippet is missing,
 * the question was re-versioned since approval, the source policy was
 * re-versioned, or there's a pending-review snippet awaiting decision.
 */
export async function GET() {
  // Latest QuestionVersion per Question, with section info
  const latestVersions = await prisma.questionVersion.findMany({
    orderBy: { version: "desc" },
    distinct: ["questionId"],
    select: {
      id: true,
      questionId: true,
      prompt: true,
      question: {
        select: {
          id: true,
          slug: true,
          sectionId: true,
          section: { select: { slug: true, displayName: true } },
        },
      },
    },
  });

  // Latest PolicyVersion per PolicyDoc — to detect policy-stale
  const latestPolicyVersions = await prisma.policyVersion.findMany({
    orderBy: { version: "desc" },
    distinct: ["policyDocId"],
    select: { id: true, policyDocId: true, version: true },
  });
  const latestPolicyByDoc = new Map(
    latestPolicyVersions.map((v) => [v.policyDocId, v.id])
  );

  // All MoreInfo rows joined with their QuestionVersion+Question and source
  const allMoreInfos = await prisma.questionMoreInfo.findMany({
    include: {
      questionVersion: { select: { id: true, questionId: true } },
      sourcePolicy: { select: { id: true, policyDocId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build lookups
  const moreInfosByQuestionId = new Map<string, typeof allMoreInfos>();
  for (const mi of allMoreInfos) {
    const qid = mi.questionVersion.questionId;
    if (!moreInfosByQuestionId.has(qid)) moreInfosByQuestionId.set(qid, []);
    moreInfosByQuestionId.get(qid)!.push(mi);
  }

  const queue: QueueItem[] = [];

  for (const qv of latestVersions) {
    const qid = qv.questionId;
    const mis = moreInfosByQuestionId.get(qid) ?? [];
    const pending = mis.find((m) => m.status === "pending_review");
    const latestApproved = mis.find((m) => m.status === "approved");

    const base = {
      questionVersionId: qv.id,
      questionId: qid,
      questionSlug: qv.question.slug,
      questionPrompt: qv.prompt,
      sectionSlug: qv.question.section.slug,
      sectionDisplayName: qv.question.section.displayName,
    };

    if (pending) {
      queue.push({ ...base, status: "pending_review", existingMoreInfoId: pending.id });
      continue;
    }

    if (!latestApproved) {
      queue.push({ ...base, status: "missing" });
      continue;
    }

    // question-stale: approved snippet was for an older QV
    if (latestApproved.questionVersion.id !== qv.id) {
      queue.push({
        ...base,
        status: "question_stale",
        existingMoreInfoId: latestApproved.id,
        staleReason: "Question text changed since the snippet was approved.",
      });
      continue;
    }

    // policy-stale: source policy has a newer version than the one the snippet
    // was approved against
    if (latestApproved.sourcePolicy) {
      const newest = latestPolicyByDoc.get(latestApproved.sourcePolicy.policyDocId);
      if (newest && newest !== latestApproved.sourcePolicy.id) {
        queue.push({
          ...base,
          status: "policy_stale",
          existingMoreInfoId: latestApproved.id,
          staleReason: "Source policy has a newer version.",
        });
        continue;
      }
    }
    // otherwise: fresh — not in the queue
  }

  // Group counts for the page header
  const counts = queue.reduce(
    (acc, q) => {
      acc[q.status] = (acc[q.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<QueueStatus, number>
  );

  return NextResponse.json({ items: queue, counts });
}
