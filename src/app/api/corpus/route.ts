export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FOUNDATION_SECTIONS = new Set(["intake", "triage"]);

/** GET /api/corpus — Browse the risk library by category or by risk */
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  const view = req.nextUrl.searchParams.get("view"); // "risk" | "category" (default)

  if (view === "risk") {
    return riskView();
  }

  // ── Category view (default) ───────────────────────────────────────────────
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

// ── Risk view ─────────────────────────────────────────────────────────────────

async function riskView() {
  // Fetch all questions with their section, latest version, and risk associations
  const questions = await prisma.question.findMany({
    include: {
      section: true,
      risks: { include: { risk: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  const risks = await prisma.risk.findMany({
    orderBy: { displayOrder: "asc" },
  });

  type QShape = {
    id: string;
    slug: string;
    sectionSlug: string;
    sectionName: string;
    prompt: string | undefined;
    answerType: string | undefined;
    helpText: string | null | undefined;
    required: boolean | undefined;
  };

  function toShape(q: (typeof questions)[number]): QShape {
    const latest = q.versions[0];
    return {
      id: q.id,
      slug: q.slug,
      sectionSlug: q.section.slug,
      sectionName: q.section.displayName,
      prompt: latest?.prompt,
      answerType: latest?.answerType,
      helpText: latest?.helpText,
      required: latest?.required,
    };
  }

  // Foundation questions (intake, triage)
  const foundation = questions
    .filter((q) => FOUNDATION_SECTIONS.has(q.section.slug))
    .map(toShape);

  // Non-foundation questions grouped by risk
  const nonFoundation = questions.filter(
    (q) => !FOUNDATION_SECTIONS.has(q.section.slug)
  );

  // Build risk buckets
  const riskBuckets = risks.map((risk) => {
    const riskQuestions = nonFoundation
      .filter((q) => q.risks.some((qr) => qr.riskId === risk.id))
      .map(toShape);
    return {
      id: risk.id,
      slug: risk.slug,
      name: risk.name,
      description: risk.description,
      questions: riskQuestions,
    };
  });

  // Unassigned: non-foundation questions with no risk associations
  const assignedIds = new Set(
    nonFoundation
      .filter((q) => q.risks.length > 0)
      .map((q) => q.id)
  );
  const unassigned = nonFoundation
    .filter((q) => !assignedIds.has(q.id))
    .map(toShape);

  return NextResponse.json({ foundation, risks: riskBuckets, unassigned });
}
