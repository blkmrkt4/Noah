export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/more-info?status=approved|pending_review|rejected&section=<slug>
 *
 * Lists snippets with derived freshness against the latest QuestionVersion and
 * latest PolicyVersion. Drives the Library page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const sectionSlug = searchParams.get("section");

  // Latest QV per question + latest PV per doc, for staleness derivation
  const [latestQVs, latestPVs] = await Promise.all([
    prisma.questionVersion.findMany({
      orderBy: { version: "desc" },
      distinct: ["questionId"],
      select: { id: true, questionId: true },
    }),
    prisma.policyVersion.findMany({
      orderBy: { version: "desc" },
      distinct: ["policyDocId"],
      select: { id: true, policyDocId: true },
    }),
  ]);
  const latestQVByQuestion = new Map(latestQVs.map((q) => [q.questionId, q.id]));
  const latestPVByDoc = new Map(latestPVs.map((p) => [p.policyDocId, p.id]));

  const where: { status?: "approved" | "pending_review" | "rejected" } = {};
  if (statusFilter === "approved" || statusFilter === "pending_review" || statusFilter === "rejected") {
    where.status = statusFilter;
  }

  const items = await prisma.questionMoreInfo.findMany({
    where,
    include: {
      questionVersion: {
        include: {
          question: {
            include: { section: { select: { slug: true, displayName: true } } },
          },
        },
      },
      sourcePolicy: {
        include: { policyDoc: { select: { id: true, title: true } } },
      },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = items
    .filter((i) =>
      sectionSlug ? i.questionVersion.question.section.slug === sectionSlug : true
    )
    .map((i) => {
      const qv = i.questionVersion;
      const isLatestQV = latestQVByQuestion.get(qv.questionId) === qv.id;
      const isLatestPV = i.sourcePolicy
        ? latestPVByDoc.get(i.sourcePolicy.policyDocId) === i.sourcePolicy.id
        : true;
      let derivedStatus: string = i.status;
      if (i.status === "approved") {
        if (!isLatestQV) derivedStatus = "question_stale";
        else if (!isLatestPV) derivedStatus = "policy_stale";
        else derivedStatus = "fresh";
      }
      return {
        id: i.id,
        body: i.body,
        rawStatus: i.status,
        derivedStatus,
        questionSlug: qv.question.slug,
        questionPrompt: qv.prompt,
        sectionSlug: qv.question.section.slug,
        sectionDisplayName: qv.question.section.displayName,
        sourcePolicyTitle: i.sourcePolicy?.policyDoc.title ?? null,
        sourcePolicyVersionId: i.sourcePolicy?.id ?? null,
        approvedBy: i.approvedBy,
        approvedAt: i.approvedAt,
        createdAt: i.createdAt,
      };
    });

  return NextResponse.json(enriched);
}
