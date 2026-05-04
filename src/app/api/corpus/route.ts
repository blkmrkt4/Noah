export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/corpus — Browse the question corpus */
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");

  const sections = await prisma.section.findMany({
    where: section ? { slug: section } : undefined,
    include: {
      questions: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            include: {
              parentDependencies: {
                include: { parentVersion: { include: { question: true } } },
              },
              childDependencies: {
                include: { childVersion: { include: { question: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  // Transform to a friendlier shape
  const result = sections.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    displayOrder: s.displayOrder,
    questions: s.questions.map((q) => {
      const latest = q.versions[0];
      return {
        id: q.id,
        slug: q.slug,
        prompt: latest?.prompt,
        answerType: latest?.answerType,
        options: latest?.options,
        helpText: latest?.helpText,
        required: latest?.required,
        aiPrepopulationPriority: latest?.aiPrepopulationPriority,
        dependsOn: latest?.parentDependencies.map((d) => ({
          slug: d.parentVersion.question.slug,
          rule: d.activationRule,
        })),
        activates: latest?.childDependencies.map((d) => ({
          slug: d.childVersion.question.slug,
          rule: d.activationRule,
        })),
      };
    }),
  }));

  return NextResponse.json(result);
}
