import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/projects/:id/documents — List documents and their extractions */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const documents = await prisma.document.findMany({
    where: { projectId },
    include: { extractions: true },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(documents);
}

/** POST /api/projects/:id/documents — Upload a document reference */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { filename, uri, mimeType } = body;

  if (!filename || !uri || !mimeType) {
    return NextResponse.json(
      { error: "filename, uri, and mimeType are required" },
      { status: 400 }
    );
  }

  const document = await prisma.document.create({
    data: { projectId, filename, uri, mimeType },
  });

  return NextResponse.json(document, { status: 201 });
}
