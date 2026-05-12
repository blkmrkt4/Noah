export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/questions/:questionVersionId/risks — Risks for a question */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ questionVersionId: string }> }
) {
  const { questionVersionId } = await params;

  // Resolve questionVersion → question → risks
  const qv = await prisma.questionVersion.findUnique({
    where: { id: questionVersionId },
    select: {
      question: {
        select: {
          risks: {
            include: { risk: true },
          },
        },
      },
    },
  });

  if (!qv) {
    return NextResponse.json({ error: "Question version not found" }, { status: 404 });
  }

  const risks = qv.question.risks.map((qr) => ({
    id: qr.risk.id,
    slug: qr.risk.slug,
    name: qr.risk.name,
    description: qr.risk.description,
  }));

  return NextResponse.json(risks);
}
