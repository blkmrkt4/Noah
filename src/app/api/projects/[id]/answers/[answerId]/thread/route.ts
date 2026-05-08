import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; answerId: string }> };

async function getOrCreateThread(answerId: string) {
  const existing = await prisma.thread.findFirst({
    where: { parentType: "answer", answerId },
  });
  if (existing) return existing;
  return prisma.thread.create({
    data: { parentType: "answer", answerId },
  });
}

/** GET /api/projects/:id/answers/:answerId/thread — return thread + comments, creating one if needed. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { answerId } = await params;
  const thread = await getOrCreateThread(answerId);
  const comments = await prisma.comment.findMany({
    where: { threadId: thread.id },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ thread, comments });
}

/** POST /api/projects/:id/answers/:answerId/thread — add a comment. Author defaults to the project's commercial owner. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId, answerId } = await params;
  const body = await req.json();
  const text: string = body.body?.toString().trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { commercialOwnerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const thread = await getOrCreateThread(answerId);

  const authorId: string = body.authorId ?? project.commercialOwnerId;
  const authorKind = body.authorKind === "system" ? "system" : "user";

  const comment = await prisma.comment.create({
    data: {
      threadId: thread.id,
      authorId,
      authorKind,
      body: text,
    },
    include: { author: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
