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

const EXT_TO_FORMAT: Record<string, "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv"> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  xlsx: "xlsx",
  csv: "csv",
};

function detectFormat(filename: string, mime: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_TO_FORMAT[ext]) return EXT_TO_FORMAT[ext];
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime.includes("csv")) return "csv";
  if (mime === "text/markdown") return "md";
  if (mime.startsWith("text/")) return "txt";
  return null;
}

/**
 * POST /api/policies/upload
 *
 * Multipart: file (one), title, sectionSlug (the primary section to bind to),
 * jurisdictionScope (JSON string | empty), description, effectiveAt (yyyy-mm-dd).
 *
 * Stores the original file, extracts text, creates PolicyDoc + PolicyVersion v1,
 * and binds the doc to the primary section. Cross-category reuse is a separate
 * call to POST /api/policies/:id/sections.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const title = (form.get("title") as string | null)?.trim();
  const sectionSlug = (form.get("sectionSlug") as string | null)?.trim();
  const description = (form.get("description") as string | null)?.trim() || null;
  const effectiveAtRaw = form.get("effectiveAt") as string | null;
  const jurisdictionScopeRaw = form.get("jurisdictionScope") as string | null;

  if (!title || !sectionSlug) {
    return NextResponse.json(
      { error: "title and sectionSlug are required" },
      { status: 400 }
    );
  }

  const section = await prisma.section.findUnique({
    where: { slug: sectionSlug },
    select: { id: true },
  });
  if (!section) {
    return NextResponse.json(
      { error: `Unknown section: ${sectionSlug}` },
      { status: 400 }
    );
  }

  const reason = rejectionReason(file.type);
  if (reason) {
    return NextResponse.json({ error: reason }, { status: 400 });
  }
  if (!isSupportedMimeType(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.name} (${file.type || "unknown"}). Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let jurisdictionScope: unknown = null;
  if (jurisdictionScopeRaw) {
    try {
      jurisdictionScope = JSON.parse(jurisdictionScopeRaw);
    } catch {
      return NextResponse.json(
        { error: "jurisdictionScope must be valid JSON" },
        { status: 400 }
      );
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let content = "";
  try {
    content = await extractText(bytes, file.type);
  } catch (err) {
    if (err instanceof UnsupportedFileError && err.userFacing) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const msg = (err as Error).message ?? "unknown error";
    console.error(`Extraction failed for ${file.name}:`, err);
    return NextResponse.json(
      {
        error: `Could not read ${file.name}. The file may be encrypted, image-only, or in a format the parser cannot handle. Underlying error: ${msg.slice(0, 200)}`,
      },
      { status: 500 }
    );
  }

  let uri: string;
  try {
    await ensureBucket();
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `policies/${Date.now()}-${safeName}`;
    uri = await uploadFile(storagePath, bytes, file.type);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown storage error";
    console.error("Storage upload failed:", err);
    return NextResponse.json(
      {
        error: `Could not store the file. Check Supabase Storage configuration at /admin/settings. Underlying error: ${msg.slice(0, 200)}`,
      },
      { status: 500 }
    );
  }

  const fileFormat = detectFormat(file.name, file.type);

  const doc = await prisma.policyDoc.create({
    data: {
      title,
      jurisdictionScope: (jurisdictionScope as never) ?? null,
      description,
      versions: {
        create: {
          version: 1,
          content,
          effectiveAt: effectiveAtRaw ? new Date(effectiveAtRaw) : new Date(),
          filename: file.name,
          uri,
          mimeType: file.type,
          fileFormat: fileFormat as never,
        },
      },
      sectionBindings: {
        create: { sectionId: section.id, isPrimary: true },
      },
    },
    include: { versions: true, sectionBindings: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
