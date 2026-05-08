import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseGitHubUrl } from "@/lib/repo-scanner";

export const runtime = "nodejs";

/** GET /api/projects/:id/repo — return current URL + scan state + findings. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { repoUrl: true, repoLastScanSha: true, repoLastScanAt: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const findings = project.repoUrl
    ? await prisma.repoFinding.findMany({
        where: { projectId, repoUrl: project.repoUrl },
        orderBy: { foundAt: "desc" },
      })
    : [];

  return NextResponse.json({
    repoUrl: project.repoUrl,
    lastScanSha: project.repoLastScanSha,
    lastScanAt: project.repoLastScanAt,
    findings,
  });
}

/** PATCH /api/projects/:id/repo — set or clear the repoUrl. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const repoUrl: string | null = body.repoUrl?.trim() || null;

  if (repoUrl) {
    try {
      parseGitHubUrl(repoUrl);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { repoUrl },
  });
  return NextResponse.json({ repoUrl });
}

// Triggering a scan now lives at POST /api/projects/:id/repo/scans (Phase 3).
