export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ questionVersionId: string }> };

/**
 * GET /api/questions/:questionVersionId/exclusions — list policy exclusions
 * authored against this QuestionVersion.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { questionVersionId } = await params;
  const rows = await prisma.questionPolicyExclusion.findMany({
    where: { questionVersionId },
    include: { policyDoc: { select: { id: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows);
}

/**
 * POST /api/questions/:questionVersionId/exclusions — exclude a policy from
 * this question's scan inputs. Body: { policyDocId }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { questionVersionId } = await params;
  const body = await req.json();
  const policyDocId: string | undefined = body.policyDocId;

  if (!policyDocId) {
    return NextResponse.json(
      { error: "policyDocId is required" },
      { status: 400 }
    );
  }

  const [qv, policy] = await Promise.all([
    prisma.questionVersion.findUnique({
      where: { id: questionVersionId },
      select: { id: true },
    }),
    prisma.policyDoc.findUnique({
      where: { id: policyDocId },
      select: { id: true },
    }),
  ]);
  if (!qv) {
    return NextResponse.json({ error: "QuestionVersion not found" }, { status: 404 });
  }
  if (!policy) {
    return NextResponse.json({ error: "PolicyDoc not found" }, { status: 404 });
  }

  const existing = await prisma.questionPolicyExclusion.findUnique({
    where: {
      questionVersionId_policyDocId: { questionVersionId, policyDocId },
    },
  });
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const row = await prisma.questionPolicyExclusion.create({
    data: { questionVersionId, policyDocId },
  });
  return NextResponse.json(row, { status: 201 });
}
