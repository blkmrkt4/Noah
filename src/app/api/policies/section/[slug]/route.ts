export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/policies/section/:slug
 *
 * One-shot payload powering the Policy Library page for one section. Returns:
 *   - policies bound to this section (with version metadata, scan status,
 *     whether the binding is primary, and the per-question exclusion list)
 *   - all latest QuestionVersions in the section, with the exclusions currently
 *     applied to each (one entry per excluded policy)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;

  const section = await prisma.section.findUnique({
    where: { slug },
    select: { id: true, slug: true, displayName: true },
  });
  if (!section) {
    return NextResponse.json(
      { error: `Unknown section: ${slug}` },
      { status: 400 }
    );
  }

  const [bindings, latestPVByDoc, sectionWithQuestions, latestQVs] = await Promise.all([
    prisma.policyDocSection.findMany({
      where: { sectionId: section.id },
      include: {
        policyDoc: {
          include: {
            versions: {
              orderBy: { version: "desc" },
              select: {
                id: true,
                version: true,
                effectiveAt: true,
                filename: true,
                fileFormat: true,
                mimeType: true,
                uploadedAt: true,
              },
            },
            sectionBindings: {
              include: {
                section: { select: { slug: true, displayName: true } },
              },
            },
            questionExclusions: {
              select: { questionVersionId: true },
            },
          },
        },
      },
      orderBy: { policyDoc: { title: "asc" } },
    }),
    prisma.policyVersion.findMany({
      orderBy: { version: "desc" },
      distinct: ["policyDocId"],
      select: { id: true, policyDocId: true },
    }),
    prisma.section.findUnique({
      where: { id: section.id },
      include: {
        questions: {
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
              select: {
                id: true,
                version: true,
                prompt: true,
                policyExclusions: {
                  select: { policyDocId: true },
                },
                moreInfos: {
                  select: {
                    id: true,
                    status: true,
                    sourcePolicyVersionId: true,
                    sourcePolicy: { select: { policyDocId: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.questionVersion.findMany({
      orderBy: { version: "desc" },
      distinct: ["questionId"],
      select: { id: true, questionId: true },
    }),
  ]);
  const latestQVByQuestion = new Map(latestQVs.map((q) => [q.questionId, q.id]));

  const latestPVByDocMap = new Map(latestPVByDoc.map((p) => [p.policyDocId, p.id]));

  const policyDocIds = bindings.map((b) => b.policyDocId);
  const scanCounts = policyDocIds.length === 0
    ? []
    : await prisma.questionMoreInfo.groupBy({
        by: ["sourcePolicyVersionId"],
        where: {
          sourcePolicyVersionId: { not: null },
          status: { in: ["pending_review", "approved"] },
          sourcePolicy: { policyDocId: { in: policyDocIds } },
        },
        _count: { _all: true },
      });
  const scanCountByPV = new Map(
    scanCounts.map((s) => [s.sourcePolicyVersionId!, s._count._all])
  );

  const policies = bindings.map((binding) => {
    const p = binding.policyDoc;
    const latestPV = latestPVByDocMap.get(p.id) ?? null;
    let scanStatus: "not_scanned" | "scanned" | "stale" = "not_scanned";
    if (latestPV && (scanCountByPV.get(latestPV) ?? 0) > 0) {
      scanStatus = "scanned";
    } else if (p.versions.some((v) => (scanCountByPV.get(v.id) ?? 0) > 0)) {
      scanStatus = "stale";
    }
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      jurisdictionScope: p.jurisdictionScope,
      latest: p.versions[0] ?? null,
      versions: p.versions,
      isPrimary: binding.isPrimary,
      otherSections: p.sectionBindings
        .filter((b) => b.sectionId !== section.id)
        .map((b) => ({ slug: b.section.slug, displayName: b.section.displayName })),
      excludedQuestionVersionIds: p.questionExclusions.map(
        (e) => e.questionVersionId
      ),
      scanStatus,
    };
  });

  const questions = (sectionWithQuestions?.questions ?? [])
    .filter((q) => q.versions.length > 0)
    .map((q) => {
      const latest = q.versions[0];
      const isLatestQV = latestQVByQuestion.get(q.id) === latest.id;
      const hasPending = latest.moreInfos.some((m) => m.status === "pending_review");
      const approved = latest.moreInfos.find((m) => m.status === "approved");

      let guidanceStatus: "fresh" | "pending" | "stale" | "missing" = "missing";
      if (hasPending) {
        guidanceStatus = "pending";
      } else if (approved) {
        const sourcePolicyVersionId = approved.sourcePolicyVersionId;
        const sourceDocId = approved.sourcePolicy?.policyDocId ?? null;
        const sourceIsLatest =
          sourcePolicyVersionId === null ||
          (sourceDocId !== null &&
            latestPVByDocMap.get(sourceDocId) === sourcePolicyVersionId);
        guidanceStatus = isLatestQV && sourceIsLatest ? "fresh" : "stale";
      }

      return {
        questionId: q.id,
        slug: q.slug,
        questionVersionId: latest.id,
        version: latest.version,
        prompt: latest.prompt,
        excludedPolicyIds: latest.policyExclusions.map((e) => e.policyDocId),
        guidanceStatus,
        guidanceRequired: q.guidanceRequired,
      };
    });

  return NextResponse.json({
    section,
    policies,
    questions,
  });
}
