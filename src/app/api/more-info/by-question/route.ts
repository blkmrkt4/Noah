export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface DraftRow {
  id: string;
  body: string;
  status: "pending_review" | "approved" | "rejected";
  sourcePolicyDocId: string | null;
  sourcePolicyTitle: string | null;
  sourcePolicyVersion: number | null;
  sourcePolicyVersionId: string | null;
  isLatestPolicyVersion: boolean;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string; email: string } | null;
}

interface QuestionGroup {
  questionVersionId: string;
  questionId: string;
  questionSlug: string;
  questionPrompt: string;
  sectionSlug: string;
  sectionDisplayName: string;
  isLatestQuestionVersion: boolean;
  drafts: DraftRow[];
  published: DraftRow | null;
}

/**
 * GET /api/more-info/by-question
 *
 * Groups QuestionMoreInfo rows by question for the merge editor. By default
 * returns only questions with active drafts pending review. Optional filter:
 *   ?include=all — include all questions even if nothing pending
 *   ?include=stale — include questions whose published snippet is stale
 *
 * Each group exposes:
 *   - drafts: all rows with sourcePolicyVersionId set, regardless of status
 *     (pending/rejected drafts kept as audit; approved per-policy snippets
 *     historically composed before the merge editor existed).
 *   - published: the latest approved row whose sourcePolicyVersionId is null
 *     (a composed snippet) or, lacking that, the latest approved per-policy row.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const include = searchParams.get("include") ?? "pending";

  const [latestQVs, latestPVs, allMoreInfos] = await Promise.all([
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
    prisma.questionMoreInfo.findMany({
      include: {
        questionVersion: {
          include: {
            question: {
              include: {
                section: { select: { slug: true, displayName: true } },
              },
            },
          },
        },
        sourcePolicy: {
          include: { policyDoc: { select: { id: true, title: true } } },
        },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestQVByQuestion = new Map(latestQVs.map((q) => [q.questionId, q.id]));
  const latestPVByDoc = new Map(latestPVs.map((p) => [p.policyDocId, p.id]));

  const groups = new Map<string, QuestionGroup>();

  for (const mi of allMoreInfos) {
    const qv = mi.questionVersion;
    const groupKey = qv.questionId;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        questionVersionId: qv.id,
        questionId: qv.questionId,
        questionSlug: qv.question.slug,
        questionPrompt: qv.prompt,
        sectionSlug: qv.question.section.slug,
        sectionDisplayName: qv.question.section.displayName,
        isLatestQuestionVersion: latestQVByQuestion.get(qv.questionId) === qv.id,
        drafts: [],
        published: null,
      };
      groups.set(groupKey, group);
    }

    const row: DraftRow = {
      id: mi.id,
      body: mi.body,
      status: mi.status,
      sourcePolicyDocId: mi.sourcePolicy?.policyDoc.id ?? null,
      sourcePolicyTitle: mi.sourcePolicy?.policyDoc.title ?? null,
      sourcePolicyVersion: mi.sourcePolicy?.version ?? null,
      sourcePolicyVersionId: mi.sourcePolicy?.id ?? null,
      isLatestPolicyVersion: mi.sourcePolicy
        ? latestPVByDoc.get(mi.sourcePolicy.policyDocId) === mi.sourcePolicy.id
        : true,
      createdAt: mi.createdAt,
      approvedAt: mi.approvedAt,
      approvedBy: mi.approvedBy,
    };

    if (mi.sourcePolicyVersionId) {
      group.drafts.push(row);
    }

    if (mi.status === "approved" && !group.published) {
      group.published = row;
    }
  }

  // Filter according to include mode.
  const all = [...groups.values()];
  const isStale = (g: QuestionGroup) => {
    const p = g.published;
    if (!p) return false;
    if (!g.isLatestQuestionVersion) return true;
    return p.sourcePolicyVersionId !== null && !p.isLatestPolicyVersion;
  };
  const hasPending = (g: QuestionGroup) =>
    g.drafts.some((d) => d.status === "pending_review");

  let filtered = all;
  if (include === "pending") {
    // Legacy alias retained for any callers — equivalent to needs_review now.
    filtered = all.filter((g) => hasPending(g) || isStale(g));
  } else if (include === "stale") {
    filtered = all.filter(isStale);
  } else if (include === "needs_review") {
    filtered = all.filter((g) => hasPending(g) || isStale(g));
  }

  // Newest activity first.
  filtered.sort((a, b) => {
    const aLatest = Math.max(
      ...a.drafts.map((d) => d.createdAt.getTime()),
      a.published?.createdAt.getTime() ?? 0
    );
    const bLatest = Math.max(
      ...b.drafts.map((d) => d.createdAt.getTime()),
      b.published?.createdAt.getTime() ?? 0
    );
    return bLatest - aLatest;
  });

  return NextResponse.json({ questions: filtered });
}
