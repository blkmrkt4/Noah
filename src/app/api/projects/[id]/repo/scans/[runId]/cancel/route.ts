import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/repo/scans/:runId/cancel
 * Owner-initiated cancel. Flips the cancelRequested flag on the run row.
 * The prepop loop polls this flag once per iteration and exits early. Heavy
 * scans (technical, risk) are single LLM calls and complete naturally.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id: projectId, runId } = await params;

  const run = await prisma.repoScanRun.findFirst({
    where: { id: runId, projectId },
    select: { id: true, status: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "running" && run.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot cancel a ${run.status} run` },
      { status: 400 }
    );
  }

  await prisma.repoScanRun.update({
    where: { id: runId },
    data: { cancelRequested: true },
  });
  return NextResponse.json({ ok: true });
}
