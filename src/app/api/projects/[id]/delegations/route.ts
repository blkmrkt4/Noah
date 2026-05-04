import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/delegations — List delegations */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const delegations = await prisma.delegation.findMany({
    where: { projectId },
    include: {
      assigner: true,
      assignee: true,
      threads: { include: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(delegations);
}

/** POST /api/projects/:id/delegations — Create a delegation */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { scopeType, scopeTarget, assignerId, assigneeId, delegateAuthority, message } = body;

  if (!scopeType || !scopeTarget || !assignerId || !assigneeId) {
    return NextResponse.json(
      { error: "scopeType, scopeTarget, assignerId, and assigneeId are required" },
      { status: 400 }
    );
  }

  // Validate: Section Leads get delegate_authority, Question Collaborators don't
  const authority = scopeType === "section" ? (delegateAuthority ?? true) : false;

  const delegation = await prisma.delegation.create({
    data: {
      projectId,
      scopeType,
      scopeTarget,
      assignerId,
      assigneeId,
      delegateAuthority: authority,
      message: message || null,
    },
    include: { assigner: true, assignee: true },
  });

  // Create a thread for delegation communication
  await prisma.thread.create({
    data: {
      parentType: "delegation",
      delegationId: delegation.id,
    },
  });

  return NextResponse.json(delegation, { status: 201 });
}
