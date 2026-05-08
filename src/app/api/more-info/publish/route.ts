export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/more-info/publish
 *
 * Publishes a composed more-info snippet for a question. Composed snippets
 * have sourcePolicyVersionId = null — they're authored, not extracted.
 *
 * Body: { questionVersionId, body, approvedById, supersedeDraftIds? }
 *
 * supersedeDraftIds: optional list of pending-review draft IDs to mark as
 * rejected when this composition is published. The merge editor sends every
 * draft that fed this composition so they're cleanly retired.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    questionVersionId,
    body: snippetBody,
    approvedById,
    supersedeDraftIds = [],
  } = body as {
    questionVersionId?: string;
    body?: string;
    approvedById?: string;
    supersedeDraftIds?: string[];
  };

  if (!questionVersionId || !snippetBody?.trim() || !approvedById) {
    return NextResponse.json(
      {
        error:
          "questionVersionId, body, and approvedById are required",
      },
      { status: 400 }
    );
  }

  const qv = await prisma.questionVersion.findUnique({
    where: { id: questionVersionId },
    select: { id: true, questionId: true },
  });
  if (!qv) {
    return NextResponse.json(
      { error: "QuestionVersion not found" },
      { status: 404 }
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Retire prior approved snippets for this question — composing replaces
    // whatever was live so the Owner-facing query has one obvious winner.
    await tx.questionMoreInfo.updateMany({
      where: {
        questionVersion: { questionId: qv.questionId },
        status: "approved",
      },
      data: { status: "rejected" },
    });

    if (supersedeDraftIds.length > 0) {
      await tx.questionMoreInfo.updateMany({
        where: { id: { in: supersedeDraftIds }, status: "pending_review" },
        data: { status: "rejected" },
      });
    }

    return tx.questionMoreInfo.create({
      data: {
        questionVersionId,
        sourcePolicyVersionId: null,
        body: snippetBody.trim(),
        status: "approved",
        approvedById,
        approvedAt: now,
      },
    });
  });

  return NextResponse.json(result, { status: 201 });
}
