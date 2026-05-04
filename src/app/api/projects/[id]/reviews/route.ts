import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/projects/:id/reviews — List all reviews for a project */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const reviews = await prisma.review.findMany({
    where: { projectId },
    include: {
      reviewer: { include: { user: true } },
      section: true,
      clarifications: {
        include: { answer: { include: { questionVersion: { include: { question: true } } } } },
      },
    },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json(reviews);
}
