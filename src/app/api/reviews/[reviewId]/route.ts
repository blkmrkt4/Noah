import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ reviewId: string }> };

/** GET /api/reviews/:reviewId — Get review detail */
export async function GET(_req: NextRequest, { params }: Params) {
  const { reviewId } = await params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      project: true,
      section: true,
      reviewer: { include: { user: true } },
      clarifications: {
        include: {
          answer: { include: { questionVersion: { include: { question: true } } } },
          threads: { include: { comments: { include: { author: true } } } },
        },
      },
      threads: { include: { comments: { include: { author: true } } } },
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  return NextResponse.json(review);
}

/** PATCH /api/reviews/:reviewId — Issue disposition */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { reviewId } = await params;
  const body = await req.json();
  const { disposition, dispositionNotes } = body;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { clarifications: true },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Cannot dispose if there are open clarifications
  const openClarifications = review.clarifications.filter(
    (c) => c.status !== "resolved"
  );
  if (openClarifications.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot issue disposition with ${openClarifications.length} open clarification(s)`,
        openClarifications: openClarifications.map((c) => c.id),
      },
      { status: 409 }
    );
  }

  if (!["approve", "conditional", "reject"].includes(disposition)) {
    return NextResponse.json(
      { error: "disposition must be: approve, conditional, or reject" },
      { status: 400 }
    );
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      disposition,
      dispositionNotes: dispositionNotes || null,
      status: "disposed",
      closedAt: new Date(),
    },
  });

  // Check if all reviews for this section are now disposed → clear section
  if (review.sectionId) {
    const sectionReviews = await prisma.review.findMany({
      where: { projectId: review.projectId, sectionId: review.sectionId },
    });
    const allDisposed = sectionReviews.every((r) => r.status === "disposed" || r.id === reviewId);
    const noneRejected = sectionReviews.every(
      (r) => r.disposition !== "reject" || r.id === reviewId
    );

    if (allDisposed && noneRejected && disposition !== "reject") {
      await prisma.sectionState.update({
        where: {
          projectId_sectionId: { projectId: review.projectId, sectionId: review.sectionId },
        },
        data: { state: "cleared", clearedAt: new Date() },
      });
    }
  }

  // Check if ALL reviews for the project are disposed → compute project disposition
  const allProjectReviews = await prisma.review.findMany({
    where: { projectId: review.projectId },
  });
  const allDone = allProjectReviews.every(
    (r) => r.status === "disposed" || r.id === reviewId
  );

  if (allDone) {
    const hasReject = allProjectReviews.some(
      (r) => (r.id === reviewId ? disposition : r.disposition) === "reject"
    );
    const hasConditional = allProjectReviews.some(
      (r) => (r.id === reviewId ? disposition : r.disposition) === "conditional"
    );

    const projectDisposition = hasReject
      ? "disposed" // rejected
      : "disposed"; // approved or conditional

    await prisma.project.update({
      where: { id: review.projectId },
      data: { status: projectDisposition },
    });
  }

  return NextResponse.json(updated);
}
