export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/risks/:riskId/questions — Associate a question with this risk */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;
  const { questionId } = await req.json();

  if (!questionId) {
    return NextResponse.json(
      { error: "questionId is required" },
      { status: 400 }
    );
  }

  const row = await prisma.questionRisk.upsert({
    where: { questionId_riskId: { questionId, riskId } },
    update: {},
    create: { questionId, riskId },
  });

  return NextResponse.json(row, { status: 201 });
}
