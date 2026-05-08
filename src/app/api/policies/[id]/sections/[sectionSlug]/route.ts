export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; sectionSlug: string }> };

/**
 * DELETE /api/policies/:id/sections/:sectionSlug — unbind a policy from a
 * section. Refuses to remove the primary binding while other bindings exist
 * (the policy needs a primary somewhere); promotes the next binding to primary
 * if the deleted one was primary AND there are siblings.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, sectionSlug } = await params;

  const section = await prisma.section.findUnique({
    where: { slug: sectionSlug },
    select: { id: true },
  });
  if (!section) {
    return NextResponse.json(
      { error: `Unknown section: ${sectionSlug}` },
      { status: 400 }
    );
  }

  const target = await prisma.policyDocSection.findUnique({
    where: {
      policyDocId_sectionId: { policyDocId: id, sectionId: section.id },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  const siblings = await prisma.policyDocSection.findMany({
    where: { policyDocId: id, NOT: { sectionId: section.id } },
    orderBy: { createdAt: "asc" },
    select: { sectionId: true },
  });

  if (target.isPrimary && siblings.length === 0) {
    return NextResponse.json(
      {
        error:
          "Cannot remove the only binding. Delete the policy if you want to remove it everywhere.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.policyDocSection.delete({
      where: {
        policyDocId_sectionId: { policyDocId: id, sectionId: section.id },
      },
    });
    if (target.isPrimary && siblings.length > 0) {
      await tx.policyDocSection.update({
        where: {
          policyDocId_sectionId: {
            policyDocId: id,
            sectionId: siblings[0].sectionId,
          },
        },
        data: { isPrimary: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
