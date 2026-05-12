export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** DELETE /api/risks/:riskId/questions/:questionId — Remove association */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ riskId: string; questionId: string }> }
) {
  const { riskId, questionId } = await params;

  await prisma.questionRisk.delete({
    where: { questionId_riskId: { questionId, riskId } },
  });

  return NextResponse.json({ ok: true });
}
