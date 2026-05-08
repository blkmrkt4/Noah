import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/more-info/:id — edit body (and optionally approve) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { body: snippetBody, approve, approvedById } = body as {
    body?: string;
    approve?: boolean;
    approvedById?: string;
  };

  const updateData: {
    body?: string;
    status?: "approved" | "rejected" | "pending_review";
    approvedById?: string | null;
    approvedAt?: Date | null;
  } = {};

  if (typeof snippetBody === "string") updateData.body = snippetBody;
  if (approve === true) {
    if (!approvedById) {
      return NextResponse.json(
        { error: "approvedById is required when approving" },
        { status: 400 }
      );
    }
    updateData.status = "approved";
    updateData.approvedById = approvedById;
    updateData.approvedAt = new Date();
  }

  const updated = await prisma.questionMoreInfo.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

/** DELETE /api/more-info/:id — reject / remove (sets status=rejected, keeps row for audit) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const updated = await prisma.questionMoreInfo.update({
    where: { id },
    data: { status: "rejected" },
  });
  return NextResponse.json(updated);
}
