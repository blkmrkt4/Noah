export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** GET /api/policies/:id/versions — list versions for a policy doc */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const versions = await prisma.policyVersion.findMany({
    where: { policyDocId: id },
    orderBy: { version: "desc" },
  });
  return NextResponse.json(versions);
}

/**
 * POST /api/policies/:id/versions — append a new PolicyVersion.
 * Auto-increments version number from the doc's current max.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { content, effectiveAt } = body;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const latest = await prisma.policyVersion.findFirst({
    where: { policyDocId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.policyVersion.create({
    data: {
      policyDocId: id,
      version: nextVersion,
      content,
      effectiveAt: effectiveAt ? new Date(effectiveAt) : new Date(),
    },
  });

  return NextResponse.json(version, { status: 201 });
}
