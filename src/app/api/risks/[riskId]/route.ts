export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/risks/:riskId — Single risk with associated questions */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    include: {
      questions: {
        include: {
          question: {
            include: {
              section: true,
              versions: { orderBy: { version: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!risk) {
    return NextResponse.json({ error: "Risk not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...risk,
    questions: risk.questions.map((qr) => {
      const latest = qr.question.versions[0];
      return {
        questionId: qr.question.id,
        slug: qr.question.slug,
        sectionSlug: qr.question.section.slug,
        sectionName: qr.question.section.displayName,
        prompt: latest?.prompt,
        answerType: latest?.answerType,
      };
    }),
  });
}

/** PATCH /api/risks/:riskId — Update a risk */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;
  const body = await req.json();
  const { name, description, displayOrder, slug } = body;

  const risk = await prisma.risk.update({
    where: { id: riskId },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(description !== undefined && { description }),
      ...(displayOrder !== undefined && { displayOrder }),
    },
  });

  return NextResponse.json(risk);
}

/** DELETE /api/risks/:riskId — Delete a risk and its question associations */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;

  await prisma.questionRisk.deleteMany({ where: { riskId } });
  await prisma.risk.delete({ where: { id: riskId } });

  return NextResponse.json({ ok: true });
}
