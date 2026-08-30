import mammoth from "mammoth";
import {
  completeDocumentExtraction,
  resolveDocumentExtractionModel,
} from "@/lib/sajilokanun/ai";
import type { GeminiContentPart } from "@/lib/sajilokanun/gemini";
import {
  DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  DOCUMENT_EXTRACTION_USER_PROMPT,
  parseExtractedJsonText,
} from "@/lib/sajilokanun/document-prompts/extract-case-document";
import {
  getSajiloKanunTokenFromRequest,
  requireSajiloKanunAccessFromRequest,
} from "@/lib/sajilokanun-guard";
import {
  createUsageRequestId,
  persistSajiloKanunUsage,
  setActiveUsageCollector,
  truncateUsageLabel,
  UsageCollector,
} from "@/lib/sajilokanun/token-usage";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_BYTES = 10 * 1024 * 1024;

type IncomingFile = {
  fileName: string;
  mimeType: string;
  data: string;
};

function parseFiles(raw: unknown): IncomingFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const fileName = typeof row.fileName === "string" ? row.fileName.trim() : "";
      const mimeType = typeof row.mimeType === "string" ? row.mimeType.trim() : "";
      const data = typeof row.data === "string" ? row.data.trim() : "";
      if (!fileName || !data) return null;
      return { fileName, mimeType, data };
    })
    .filter((item): item is IncomingFile => item !== null);
}

function stripDataUrl(data: string): string {
  const match = data.match(/^data:[^;]+;base64,(.+)$/i);
  return match?.[1] ?? data;
}

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

function resolveMime(file: IncomingFile): string {
  const mime = file.mimeType.toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = extOf(file.fileName);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".txt") return "text/plain";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return mime || "application/octet-stream";
}

async function fileToParts(file: IncomingFile): Promise<GeminiContentPart[]> {
  const base64 = stripDataUrl(file.data);
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new Error(`Empty file: ${file.fileName}`);
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error(`File too large (max 10 MB): ${file.fileName}`);
  }

  const mime = resolveMime(file);
  const ext = extOf(file.fileName);
  const label = `--- फाइल: ${file.fileName} ---`;

  if (mime.startsWith("image/") || mime === "application/pdf") {
    return [
      { text: label },
      { inlineData: { mimeType: mime, data: base64 } },
    ];
  }

  if (mime.startsWith("text/") || ext === ".txt" || ext === ".csv" || ext === ".rtf") {
    const text = buffer.toString("utf8");
    return [{ text: `${label}\n${text}` }];
  }

  if (
    ext === ".docx" ||
    mime.includes("wordprocessingml") ||
    mime === "application/msword"
  ) {
    if (ext === ".doc") {
      throw new Error(
        `Legacy .doc is not supported for extraction. Convert to PDF/DOCX/image: ${file.fileName}`
      );
    }
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() ?? "";
    if (!text) {
      throw new Error(`Could not read text from ${file.fileName}`);
    }
    return [{ text: `${label}\n${text}` }];
  }

  throw new Error(
    `Unsupported file type for extraction: ${file.fileName}. Use PDF, image, TXT, or DOCX.`
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const files = parseFiles(body.files);
    if (files.length === 0) {
      return Response.json(
        { error: "Upload at least one document or image to extract." },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES) {
      return Response.json(
        { error: `You can extract from at most ${MAX_FILES} files at once.` },
        { status: 400 }
      );
    }

    const denied = await requireSajiloKanunAccessFromRequest(request);
    if (denied) return denied;

    const parts: GeminiContentPart[] = [{ text: DOCUMENT_EXTRACTION_USER_PROMPT }];
    for (const file of files) {
      parts.push(...(await fileToParts(file)));
    }

    const model = resolveDocumentExtractionModel();
    const collector = new UsageCollector();
    const requestId = createUsageRequestId();
    setActiveUsageCollector(collector);

    let rawText: string;
    try {
      rawText = await completeDocumentExtraction(
        DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
        parts
      );
    } finally {
      setActiveUsageCollector(null);
    }

    let extracted;
    try {
      extracted = parseExtractedJsonText(rawText);
    } catch (parseErr) {
      console.error(
        "[extract-document] raw model output (first 2k):",
        rawText.slice(0, 2000)
      );
      throw parseErr;
    }

    const token = getSajiloKanunTokenFromRequest(request);
    if (token) {
      await persistSajiloKanunUsage(token, collector.getEntries(), {
        requestId,
        requestType: "chat",
        label: truncateUsageLabel(
          `Document extract — ${files.map((f) => f.fileName).join(", ")}`
        ),
      });
    }

    return Response.json({
      extracted,
      model,
      fileNames: files.map((f) => f.fileName),
    });
  } catch (err) {
    console.error("[extract-document]", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to extract document facts",
      },
      { status: 500 }
    );
  }
}
