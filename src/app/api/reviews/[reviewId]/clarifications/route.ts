import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ reviewId: string }> };

/** GET /api/reviews/:reviewId/clarifications — List clarifications */
export async function GET(_req: NextRequest, { params }: Params) {
  const { reviewId } = await params;

  const clarifications = await prisma.clarification.findMany({
    where: { reviewId },
    include: {
      answer: { include: { questionVersion: { include: { question: true } } } },
      threads: { include: { comments: { include: { author: true } } } },
    },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json(clarifications);
}

/** POST /api/reviews/:reviewId/clarifications — Open a clarification on an answer */
export async function POST(req: NextRequest, { params }: Params) {
  const { reviewId } = await params;
  const body = await req.json();
  const { answerId, message, authorId } = body;

  if (!answerId) {
    return NextResponse.json({ error: "answerId is required" }, { status: 400 });
  }

  // Create clarification
  const clarification = await prisma.clarification.create({
    data: {
      reviewId,
      answerId,
    },
  });

  // Flip the answer's in_clarification flag
  await prisma.answer.update({
    where: { id: answerId },
    data: { inClarification: true },
  });

  // Revert section state to under_review if it was cleared
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });
  if (review?.sectionId) {
    await prisma.sectionState.updateMany({
      where: {
        projectId: review.projectId,
        sectionId: review.sectionId,
        state: "cleared",
      },
      data: { state: "under_review", clearedAt: null },
    });
  }

  // Create a thread for the clarification discussion
  const thread = await prisma.thread.create({
    data: {
      parentType: "clarification",
      clarificationId: clarification.id,
    },
  });

  // Add initial comment if message provided
  if (message && authorId) {
    await prisma.comment.create({
      data: {
        threadId: thread.id,
        authorId,
        authorKind: "user",
        body: message,
      },
    });
  }

  return NextResponse.json(clarification, { status: 201 });
}
