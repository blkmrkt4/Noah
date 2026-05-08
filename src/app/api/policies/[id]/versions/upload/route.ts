export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBucket, uploadFile } from "@/lib/storage";
import {
  SUPPORTED_EXTENSIONS,
  UnsupportedFileError,
  extractText,
  isSupportedMimeType,
  rejectionReason,
} from "@/lib/extractors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function detectFormat(filename: string, mime: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "docx", "txt", "md", "xlsx", "csv"].includes(ext)) return ext;
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime.includes("csv")) return "csv";
  if (mime === "text/markdown") return "md";
  if (mime.startsWith("text/")) return "txt";
  return null;
}

/**
 * POST /api/policies/:id/versions/upload
 *
 * Multipart: file (one), effectiveAt (yyyy-mm-dd).
 * Appends a new PolicyVersion auto-incrementing version number.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const effectiveAtRaw = form.get("effectiveAt") as string | null;

  const reason = rejectionReason(file.type);
  if (reason) return NextResponse.json({ error: reason }, { status: 400 });
  if (!isSupportedMimeType(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.name} (${file.type || "unknown"}). Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const policy = await prisma.policyDoc.findUnique({ where: { id } });
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let content = "";
  try {
    content = await extractText(bytes, file.type);
  } catch (err) {
    if (err instanceof UnsupportedFileError && err.userFacing) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Extraction failed for ${file.name}:`, err);
    return NextResponse.json(
      { error: `Failed to extract text from ${file.name}` },
      { status: 500 }
    );
  }

  await ensureBucket();
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const storagePath = `policies/${Date.now()}-${safeName}`;
  const uri = await uploadFile(storagePath, bytes, file.type);

  const latest = await prisma.policyVersion.findFirst({
    where: { policyDocId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  const fileFormat = detectFormat(file.name, file.type);

  const version = await prisma.policyVersion.create({
    data: {
      policyDocId: id,
      version: nextVersion,
      content,
      effectiveAt: effectiveAtRaw ? new Date(effectiveAtRaw) : new Date(),
      filename: file.name,
      uri,
      mimeType: file.type,
      fileFormat: fileFormat as never,
    },
  });

  return NextResponse.json(version, { status: 201 });
}
