import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; sectionId: string }> };

/** GET /api/projects/:id/sections/:sectionId — Get section state */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId, sectionId } = await params;

  const sectionState = await prisma.sectionState.findUnique({
    where: { projectId_sectionId: { projectId, sectionId } },
    include: { section: true },
  });

  if (!sectionState) {
    return NextResponse.json({ error: "Section state not found" }, { status: 404 });
  }

  return NextResponse.json(sectionState);
}

/** PATCH /api/projects/:id/sections/:sectionId — Transition section state */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, sectionId } = await params;
  const body = await req.json();
  const { action } = body; // "release" | "clear"

  const current = await prisma.sectionState.findUnique({
    where: { projectId_sectionId: { projectId, sectionId } },
  });

  if (!current) {
    return NextResponse.json({ error: "Section state not found" }, { status: 404 });
  }

  // State machine transitions
  const transitions: Record<string, { validFrom: string[]; to: string; timestamp?: string }> = {
    release: {
      validFrom: ["drafting"],
      to: "released",
      timestamp: "releasedAt",
    },
    start_review: {
      validFrom: ["released"],
      to: "under_review",
    },
    clear: {
      validFrom: ["under_review"],
      to: "cleared",
      timestamp: "clearedAt",
    },
    reopen: {
      validFrom: ["cleared"],
      to: "under_review",
    },
  };

  const transition = transitions[action];
  if (!transition) {
    return NextResponse.json(
      { error: `Invalid action: ${action}. Valid: ${Object.keys(transitions).join(", ")}` },
      { status: 400 }
    );
  }

  if (!transition.validFrom.includes(current.state)) {
    return NextResponse.json(
      { error: `Cannot ${action} from state "${current.state}"` },
      { status: 409 }
    );
  }

  const updateData: Record<string, unknown> = { state: transition.to };
  if (transition.timestamp) {
    updateData[transition.timestamp] = new Date();
  }

  const updated = await prisma.sectionState.update({
    where: { projectId_sectionId: { projectId, sectionId } },
    data: updateData,
    include: { section: true },
  });

  return NextResponse.json(updated);
}
