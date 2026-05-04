import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/projects/:id — Get project with full details */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      commercialOwner: true,
      jurisdictions: { include: { jurisdiction: true } },
      sectionStates: { include: { section: true } },
      answers: {
        include: {
          questionVersion: { include: { question: { include: { section: true } } } },
          discrepancies: true,
        },
      },
      documents: { include: { extractions: true } },
      repoFindings: true,
      patternMatches: { include: { patternVersion: { include: { pattern: true } } } },
      reviews: { include: { reviewer: true, clarifications: true } },
      delegations: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

/** PATCH /api/projects/:id — Update project (name, status, submit) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, status } = body;

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (status) {
    updateData.status = status;
    if (status === "submitted") {
      updateData.submittedAt = new Date();
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
    include: { commercialOwner: true },
  });

  return NextResponse.json(project);
}
