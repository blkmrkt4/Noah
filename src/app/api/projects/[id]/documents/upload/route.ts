import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBucket, uploadFile } from "@/lib/storage";
import { isSupportedMimeType, SUPPORTED_EXTENSIONS } from "@/lib/extractors";
import { extractDocument, prePopulateAnswers } from "@/lib/ingestion";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/documents/upload
 *
 * Multipart request with one or more files in the "files" field.
 * Stores each in Supabase Storage, creates a Document row, and runs extraction.
 * Returns the created documents with their extraction status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  for (const f of files) {
    if (!isSupportedMimeType(f.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${f.name} (${f.type || "unknown"}). Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  await ensureBucket();

  const created: { id: string; filename: string }[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `${projectId}/${Date.now()}-${safeName}`;
    const uri = await uploadFile(storagePath, bytes, file.type);

    const doc = await prisma.document.create({
      data: {
        projectId,
        filename: file.name,
        uri,
        mimeType: file.type,
      },
    });
    created.push({ id: doc.id, filename: doc.filename });
  }

  // Extraction + pre-pop happen synchronously so the user sees results.
  // For production, move to a background queue.
  for (const doc of created) {
    try {
      await extractDocument(doc.id);
    } catch (err) {
      console.error(`Extraction failed for ${doc.filename}:`, err);
    }
  }

  let prePopulated = 0;
  try {
    const stats = await prePopulateAnswers(projectId);
    prePopulated = stats.answersWritten;
  } catch (err) {
    console.error("Pre-population failed:", err);
  }

  return NextResponse.json({
    uploaded: created.length,
    documents: created,
    answersPrePopulated: prePopulated,
  });
}
