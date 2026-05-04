export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/projects — Create a new project */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, commercialOwnerId, scopeType, jurisdictionIds } = body;

  if (!name || !commercialOwnerId || !scopeType) {
    return NextResponse.json(
      { error: "name, commercialOwnerId, and scopeType are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name,
      commercialOwnerId,
      scopeType,
      jurisdictions: jurisdictionIds?.length
        ? {
            create: jurisdictionIds.map((jId: string) => ({
              jurisdictionId: jId,
            })),
          }
        : undefined,
    },
    include: {
      commercialOwner: true,
      jurisdictions: { include: { jurisdiction: true } },
    },
  });

  // Create SectionStates for all sections
  const sections = await prisma.section.findMany();
  await prisma.sectionState.createMany({
    data: sections.map((s) => ({
      projectId: project.id,
      sectionId: s.id,
      state: "drafting" as const,
    })),
  });

  return NextResponse.json(project, { status: 201 });
}

/** GET /api/projects — List all projects */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");

  const projects = await prisma.project.findMany({
    where: ownerId ? { commercialOwnerId: ownerId } : undefined,
    include: {
      commercialOwner: true,
      jurisdictions: { include: { jurisdiction: true } },
      sectionStates: { include: { section: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}
