import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/projects/:id/links — list project links, newest first. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const links = await prisma.projectLink.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ links });
}

/** POST /api/projects/:id/links — add a link. Body: { url, label? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : null;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "url is not a valid URL" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const link = await prisma.projectLink.create({
    data: { projectId, url, label: label || null },
  });
  return NextResponse.json({ link }, { status: 201 });
}
