import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ clarificationId: string }> };

/** PATCH /api/clarifications/:id — Transition clarification state */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { clarificationId } = await params;
  const body = await req.json();
  const { action } = body; // "respond" | "resolve"

  const clarification = await prisma.clarification.findUnique({
    where: { id: clarificationId },
  });

  if (!clarification) {
    return NextResponse.json({ error: "Clarification not found" }, { status: 404 });
  }

  if (action === "respond") {
    if (clarification.status !== "open") {
      return NextResponse.json(
        { error: `Cannot respond from state "${clarification.status}"` },
        { status: 409 }
      );
    }

    const updated = await prisma.clarification.update({
      where: { id: clarificationId },
      data: { status: "responded" },
    });

    return NextResponse.json(updated);
  }

  if (action === "resolve") {
    if (clarification.status === "resolved") {
      return NextResponse.json(
        { error: "Clarification already resolved" },
        { status: 409 }
      );
    }

    const updated = await prisma.clarification.update({
      where: { id: clarificationId },
      data: { status: "resolved", resolvedAt: new Date() },
    });

    // Clear the in_clarification flag on the answer
    await prisma.answer.update({
      where: { id: clarification.answerId },
      data: { inClarification: false },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: "action must be 'respond' or 'resolve'" },
    { status: 400 }
  );
}
