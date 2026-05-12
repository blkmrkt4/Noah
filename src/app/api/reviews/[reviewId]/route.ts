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

/** PATCH /api/reviews/:reviewId — Issue disposition or record view */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { reviewId } = await params;
  const body = await req.json();

  // View tracking: just update lastViewedAt without changing status
  if (body.action === "view") {
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { lastViewedAt: new Date() },
    });
    return NextResponse.json({ id: updated.id, lastViewedAt: updated.lastViewedAt });
  }

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

  // Check if all critical-path reviews for this section are disposed → clear section.
  // Advisory reviews past their deadline are treated as implicit approvals and don't block.
  const now = new Date();

  if (review.sectionId) {
    const sectionReviews = await prisma.review.findMany({
      where: { projectId: review.projectId, sectionId: review.sectionId },
    });

    const sectionCleared = sectionReviews.every((r) => {
      const effectiveDisposition = r.id === reviewId ? disposition : r.disposition;
      const effectiveStatus = r.id === reviewId ? "disposed" : r.status;

      // Disposed reviews pass if not rejected
      if (effectiveStatus === "disposed") return effectiveDisposition !== "reject";

      // Non-critical reviews past deadline = implicit green
      if (!r.isCriticalPath && r.advisoryDeadline && r.advisoryDeadline <= now) return true;

      // Critical-path review still open = blocks
      if (r.isCriticalPath) return false;

      // Advisory review before deadline = doesn't block
      return !r.isCriticalPath;
    });

    if (sectionCleared && disposition !== "reject") {
      await prisma.sectionState.update({
        where: {
          projectId_sectionId: { projectId: review.projectId, sectionId: review.sectionId },
        },
        data: { state: "cleared", clearedAt: new Date() },
      });
    }
  }

  // Check if ALL critical-path reviews for the project are done → project disposition
  const allProjectReviews = await prisma.review.findMany({
    where: { projectId: review.projectId },
  });

  const allDone = allProjectReviews.every((r) => {
    if (r.status === "disposed" || r.id === reviewId) return true;
    // Advisory past deadline counts as done
    if (!r.isCriticalPath && r.advisoryDeadline && r.advisoryDeadline <= now) return true;
    // Non-critical without deadline still blocks (shouldn't happen, but safe)
    return !r.isCriticalPath;
  });

  if (allDone) {
    await prisma.project.update({
      where: { id: review.projectId },
      data: { status: "disposed" },
    });
  }

  return NextResponse.json(updated);
}
