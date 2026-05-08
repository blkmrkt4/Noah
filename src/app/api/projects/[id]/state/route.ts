import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveQuestions } from "@/lib/activation-engine";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id/state — section states + per-section progress (active questions only).
 * Used by the questionnaire to show status pills + decide when "Release section" is enabled.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { commercialOwnerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sectionStates = await prisma.sectionState.findMany({
    where: { projectId },
    include: { section: true },
  });

  const { activeQuestionVersionIds } = await getActiveQuestions(projectId);

  const activeVersions = await prisma.questionVersion.findMany({
    where: { id: { in: activeQuestionVersionIds } },
    include: {
      question: { include: { section: true } },
      answers: { where: { projectId } },
    },
  });

  const progressBySectionSlug: Record<
    string,
    { total: number; required: number; answered: number; requiredAnswered: number }
  > = {};

  for (const v of activeVersions) {
    const slug = v.question.section.slug;
    progressBySectionSlug[slug] ??= { total: 0, required: 0, answered: 0, requiredAnswered: 0 };
    const bucket = progressBySectionSlug[slug];
    bucket.total += 1;
    if (v.required) bucket.required += 1;
    if (v.answers.length > 0) {
      bucket.answered += 1;
      if (v.required) bucket.requiredAnswered += 1;
    }
  }

  const sections = sectionStates.map((ss) => {
    const p = progressBySectionSlug[ss.section.slug] ?? {
      total: 0,
      required: 0,
      answered: 0,
      requiredAnswered: 0,
    };
    return {
      sectionId: ss.sectionId,
      slug: ss.section.slug,
      displayName: ss.section.displayName,
      displayOrder: ss.section.displayOrder,
      state: ss.state,
      releasedAt: ss.releasedAt,
      clearedAt: ss.clearedAt,
      progress: p,
      canRelease:
        ss.state === "drafting" && p.required > 0 && p.requiredAnswered === p.required,
    };
  });

  sections.sort((a, b) => a.displayOrder - b.displayOrder);

  return NextResponse.json({
    commercialOwnerId: project.commercialOwnerId,
    sections,
  });
}
