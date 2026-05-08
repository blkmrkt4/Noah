import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** DELETE /api/projects/:id/links/:linkId — remove a link. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id: projectId, linkId } = await params;

  const link = await prisma.projectLink.findFirst({
    where: { id: linkId, projectId },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.projectLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
