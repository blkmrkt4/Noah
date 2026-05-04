import { NextRequest, NextResponse } from "next/server";
import { extractDocument, scanRepo, prePopulateAnswers } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";

/** POST /api/projects/:id/ingest — Trigger ingestion pipeline */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { actions } = body; // ["extract_documents", "scan_repo", "pre_populate"]

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const results: Record<string, unknown> = {};

  if (actions?.includes("extract_documents")) {
    const docs = await prisma.document.findMany({
      where: { projectId, extractions: { none: {} } },
    });
    for (const doc of docs) {
      await extractDocument(doc.id);
    }
    results.documents_extracted = docs.length;
  }

  if (actions?.includes("scan_repo")) {
    const { repoUrl } = body;
    if (repoUrl) {
      await scanRepo(projectId, repoUrl);
      results.repo_scanned = repoUrl;
    }
  }

  if (actions?.includes("pre_populate")) {
    const count = await prePopulateAnswers(projectId);
    results.answers_pre_populated = count;
  }

  return NextResponse.json({ status: "completed", results });
}
