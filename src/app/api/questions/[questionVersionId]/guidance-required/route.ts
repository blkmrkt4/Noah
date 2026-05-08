import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ questionVersionId: string }> };

/**
 * PATCH /api/questions/:questionVersionId/guidance-required
 *
 * Flips the guidanceRequired flag on the parent Question (stable identity,
 * not per-version). When false, scans skip the question entirely and the
 * Commercial Owner UI suppresses the (i) guidance affordance.
 *
 * Body: { guidanceRequired: boolean }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { questionVersionId } = await params;
  const body = await req.json();
  const { guidanceRequired } = body as { guidanceRequired?: boolean };

  if (typeof guidanceRequired !== "boolean") {
    return NextResponse.json(
      { error: "guidanceRequired must be a boolean" },
      { status: 400 }
    );
  }

  const qv = await prisma.questionVersion.findUnique({
    where: { id: questionVersionId },
    select: { questionId: true },
  });
  if (!qv) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const updated = await prisma.question.update({
    where: { id: qv.questionId },
    data: { guidanceRequired },
    select: { id: true, guidanceRequired: true },
  });

  return NextResponse.json(updated);
}
