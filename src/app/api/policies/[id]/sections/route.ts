export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/policies/:id/sections — list bindings for a policy.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const bindings = await prisma.policyDocSection.findMany({
    where: { policyDocId: id },
    include: {
      section: { select: { slug: true, displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(bindings);
}

/**
 * POST /api/policies/:id/sections — bind this policy to an additional section
 * (cross-category reuse). Body: { sectionSlug }
 *
 * Always created as non-primary. The first binding created at upload time
 * carries isPrimary=true; everything added later is a reuse alias.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const sectionSlug: string | undefined = body.sectionSlug;

  if (!sectionSlug) {
    return NextResponse.json(
      { error: "sectionSlug is required" },
      { status: 400 }
    );
  }

  const [policy, section] = await Promise.all([
    prisma.policyDoc.findUnique({ where: { id }, select: { id: true } }),
    prisma.section.findUnique({
      where: { slug: sectionSlug },
      select: { id: true },
    }),
  ]);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }
  if (!section) {
    return NextResponse.json(
      { error: `Unknown section: ${sectionSlug}` },
      { status: 400 }
    );
  }

  const existing = await prisma.policyDocSection.findUnique({
    where: {
      policyDocId_sectionId: { policyDocId: id, sectionId: section.id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already bound to this section" },
      { status: 409 }
    );
  }

  const binding = await prisma.policyDocSection.create({
    data: { policyDocId: id, sectionId: section.id, isPrimary: false },
    include: { section: { select: { slug: true, displayName: true } } },
  });

  return NextResponse.json(binding, { status: 201 });
}
