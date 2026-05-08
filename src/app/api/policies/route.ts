export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/policies — list all policies with version count, latest version,
 * and the sections each is bound to. Used by the policies sidebar and the
 * cross-category reuse picker.
 */
export async function GET() {
  const docs = await prisma.policyDoc.findMany({
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          effectiveAt: true,
          filename: true,
          fileFormat: true,
          uploadedAt: true,
        },
      },
      sectionBindings: {
        include: {
          section: { select: { id: true, slug: true, displayName: true } },
        },
      },
      _count: { select: { versions: true } },
    },
    orderBy: { title: "asc" },
  });
  return NextResponse.json(docs);
}

/**
 * POST /api/policies — create a new PolicyDoc with its first PolicyVersion
 * and bind it to a primary section.
 *
 * Body: { title, sectionSlug, jurisdictionScope?, content, effectiveAt? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, sectionSlug, jurisdictionScope, content, effectiveAt } = body;

  if (!title || !sectionSlug || !content) {
    return NextResponse.json(
      { error: "title, sectionSlug, and content are required" },
      { status: 400 }
    );
  }

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

  const doc = await prisma.policyDoc.create({
    data: {
      title,
      jurisdictionScope: jurisdictionScope ?? null,
      versions: {
        create: {
          version: 1,
          content,
          effectiveAt: effectiveAt ? new Date(effectiveAt) : new Date(),
        },
      },
      sectionBindings: {
        create: { sectionId: section.id, isPrimary: true },
      },
    },
    include: { versions: true, sectionBindings: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
