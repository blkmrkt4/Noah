export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ questionVersionId: string; policyDocId: string }> };

/**
 * DELETE /api/questions/:questionVersionId/exclusions/:policyDocId — restore
 * a previously-excluded policy as an input for this question's scans.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { questionVersionId, policyDocId } = await params;

  const existing = await prisma.questionPolicyExclusion.findUnique({
    where: {
      questionVersionId_policyDocId: { questionVersionId, policyDocId },
    },
  });
  if (!existing) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  await prisma.questionPolicyExclusion.delete({
    where: {
      questionVersionId_policyDocId: { questionVersionId, policyDocId },
    },
  });
  return NextResponse.json({ ok: true, removed: 1 });
}
