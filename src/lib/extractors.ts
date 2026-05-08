/**
 * File text extraction by mime type. Returns plain UTF-8 text suitable for
 * LLM scanning. PPTX and legacy .xls/.ppt are rejected with user-facing
 * guidance — converting them does not preserve enough fidelity for
 * policy-driven scanning.
 */

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "text/csv",
  "application/csv",
  "text/plain",
  "text/markdown",
] as const;

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
] as const;

const REJECTED_MIME_TO_REASON: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PowerPoint isn't accepted. Re-author the relevant content in PDF, DOCX, or Markdown — converting a deck to PDF does not preserve enough fidelity for policy-driven scanning.",
  "application/vnd.ms-powerpoint":
    "Legacy PowerPoint (.ppt) isn't accepted. Re-author the relevant content in PDF, DOCX, or Markdown so the policy text can be scanned faithfully.",
  "application/vnd.ms-excel":
    "Legacy Excel (.xls) isn't accepted. Save as .xlsx in modern Excel and re-upload.",
};

export class UnsupportedFileError extends Error {
  readonly userFacing: boolean;
  constructor(message: string, userFacing: boolean) {
    super(message);
    this.name = "UnsupportedFileError";
    this.userFacing = userFacing;
  }
}

export function isSupportedMimeType(mime: string): boolean {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

export function rejectionReason(mime: string): string | null {
  return REJECTED_MIME_TO_REASON[mime] ?? null;
}

export async function extractText(
  bytes: Buffer,
  mimeType: string
): Promise<string> {
  const reason = REJECTED_MIME_TO_REASON[mimeType];
  if (reason) throw new UnsupportedFileError(reason, true);

  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return extractXlsx(bytes);
  }

  if (mimeType === "text/csv" || mimeType === "application/csv") {
    return extractCsv(bytes);
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return bytes.toString("utf-8");
  }

  throw new UnsupportedFileError(`Unsupported mime type: ${mimeType}`, false);
}

async function extractXlsx(bytes: Buffer): Promise<string> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);

  const out: string[] = [];
  wb.eachSheet((sheet) => {
    out.push(`Sheet: ${sheet.name}`);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        cells.push(formatCell(cell.value));
      });
      if (cells.some((c) => c.length > 0)) out.push(cells.join("\t"));
    });
    out.push("");
  });
  return out.join("\n").trim();
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if ("result" in obj) return formatCell(obj.result);
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((rt) =>
          rt && typeof rt === "object" && "text" in rt
            ? String((rt as Record<string, unknown>).text ?? "")
            : ""
        )
        .join("");
    }
    if (typeof obj.hyperlink === "string") {
      return typeof obj.text === "string" ? obj.text : obj.hyperlink;
    }
  }
  return String(v);
}

async function extractCsv(bytes: Buffer): Promise<string> {
  const { parse } = await import("csv-parse/sync");
  const records = parse(bytes, {
    columns: false,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true,
  }) as string[][];
  return records.map((row) => row.join("\t")).join("\n");
}

/** Truncate to ~N chars without cutting words mid-token. */
export function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > maxChars * 0.8 ? lastSpace : maxChars) + "…";
}
