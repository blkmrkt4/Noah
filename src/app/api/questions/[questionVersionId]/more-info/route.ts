export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ questionVersionId: string }> };

/**
 * GET /api/questions/:questionVersionId/more-info
 *
 * Returns the live "more info" snippet for a question — the latest approved
 * snippet across all versions of this Question. Used by the Commercial Owner
 * questionnaire to populate the (i) panel.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { questionVersionId } = await params;

  const qv = await prisma.questionVersion.findUnique({
    where: { id: questionVersionId },
    select: { questionId: true },
  });
  if (!qv) {
    return NextResponse.json({ snippet: null }, { status: 404 });
  }

  const snippet = await prisma.questionMoreInfo.findFirst({
    where: {
      status: "approved",
      questionVersion: { questionId: qv.questionId },
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    include: {
      sourcePolicy: { include: { policyDoc: { select: { title: true } } } },
      questionVersion: { select: { id: true } },
    },
  });

  if (!snippet) {
    return NextResponse.json({ snippet: null });
  }

  return NextResponse.json({
    snippet: {
      id: snippet.id,
      body: snippet.body,
      sourcePolicyTitle: snippet.sourcePolicy?.policyDoc.title ?? null,
      sourcePolicyVersion: snippet.sourcePolicy?.version ?? null,
      approvedAt: snippet.approvedAt,
      isStaleForCurrentQuestion:
        snippet.questionVersion.id !== questionVersionId,
    },
  });
}
