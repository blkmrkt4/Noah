import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ threadId: string }> };

/** GET /api/threads/:threadId/comments — List comments in a thread */
export async function GET(_req: NextRequest, { params }: Params) {
  const { threadId } = await params;

  const comments = await prisma.comment.findMany({
    where: { threadId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

/** POST /api/threads/:threadId/comments — Add a comment */
export async function POST(req: NextRequest, { params }: Params) {
  const { threadId } = await params;
  const body = await req.json();
  const { authorId, body: commentBody, authorKind } = body;

  if (!authorId || !commentBody) {
    return NextResponse.json(
      { error: "authorId and body are required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      threadId,
      authorId,
      authorKind: authorKind || "user",
      body: commentBody,
    },
    include: { author: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
