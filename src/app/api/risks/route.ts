export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/risks — List all risks with question counts */
export async function GET() {
  const risks = await prisma.risk.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { questions: true } } },
  });
  return NextResponse.json(risks);
}

/** POST /api/risks — Create a new risk */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, name, description, displayOrder } = body;

  if (!slug || !name) {
    return NextResponse.json(
      { error: "slug and name are required" },
      { status: 400 }
    );
  }

  const risk = await prisma.risk.create({
    data: {
      slug,
      name,
      description: description || null,
      displayOrder: displayOrder ?? 0,
    },
  });

  return NextResponse.json(risk, { status: 201 });
}
