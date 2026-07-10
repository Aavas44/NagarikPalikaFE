import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import { hasOcrSidecar, loadOcrPages } from "./pdf-ocr";
import {
  cleanMixedLegacy,
  convertLegacyFont,
  convertLegacyTextFile,
  devanagariRatio,
} from "./legacy-font-convert";
import { cleanNepaliText } from "./text-clean";
import { splitTextIntoChunks } from "./chunk";
import { splitLegalSections, titleFromFilename, type LegalChunk } from "./legal-chunk";

export type { LegalChunk };

export type PdfPage = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  content: string;
  pageNumber: number;
};

function cleanPageText(raw: string, useLegacyConversion: boolean): string {
  if (!raw.trim()) return "";

  let text =
    useLegacyConversion && devanagariRatio(raw) < 0.25
      ? convertLegacyFont(raw)
      : raw;

  text = cleanMixedLegacy(text);
  return cleanNepaliText(text);
}

export async function extractPdfPages(filePath: string): Promise<PdfPage[]> {
  const absolutePath = path.resolve(filePath);
  if (hasOcrSidecar(absolutePath)) {
    const ocrPages = loadOcrPages(absolutePath);
    if (ocrPages.length > 0) {
      console.log(`  Using OCR sidecar (${ocrPages.length} pages)`);
      return ocrPages;
    }
  }

  const buffer = fs.readFileSync(filePath);
  const pages: string[] = [];
  let needsLegacy = false;

  await pdf(buffer, {
    pagerender(pageData: { getTextContent: () => Promise<{ items: { str?: string }[] }> }) {
      return pageData.getTextContent().then((textContent) => {
        const raw = textContent.items.map((item) => item.str ?? "").join(" ");
        if (devanagariRatio(raw) < 0.25) {
          needsLegacy = true;
        }
        pages.push(raw);
        return `${raw}\n`;
      });
    },
  });

  if (needsLegacy) {
    console.log("  Legacy font detected — converting per page");
  }

  return pages
    .map((raw, index) => ({
      pageNumber: index + 1,
      text: cleanPageText(raw, needsLegacy),
    }))
    .filter((page) => page.text.length > 0);
}

export function splitPagesIntoChunks(pages: PdfPage[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    for (const content of splitTextIntoChunks(page.text)) {
      chunks.push({ content, pageNumber: page.pageNumber });
    }
  }

  return chunks;
}

export function splitPagesIntoLegalChunks(
  pages: PdfPage[],
  filename: string
): LegalChunk[] {
  const actTitle = titleFromFilename(filename);
  return splitLegalSections(pages, actTitle);
}

export function useLegalChunking(filename: string): boolean {
  return (
    /देवानी.*संहिता|संहिता.*देवानी|अपराध.*संहिता|संहिता.*अपराध/i.test(
      filename
    ) || /कार्यविधि|karyavidhi|faujdar|फौजदारी/i.test(filename)
  );
}

export type IngestChunk = {
  content: string;
  pageNumber: number;
  sectionLabel: string | null;
  chapter: string | null;
  sectionTitle: string | null;
  /** Context-prepended text for embedding (structured indexing) */
  embedText?: string;
  chunkId?: string;
  part?: string | null;
  subsectionLabel?: string | null;
  clauseLabel?: string | null;
  metadata?: Record<string, unknown>;
};

export function splitPagesForIngest(
  pages: PdfPage[],
  filename: string
): IngestChunk[] {
  if (useLegalChunking(filename)) {
    return splitPagesIntoLegalChunks(pages, filename).map((chunk) => ({
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      sectionLabel: chunk.sectionLabel,
      chapter: chunk.chapter,
      sectionTitle: chunk.sectionTitle,
    }));
  }

  return splitPagesIntoChunks(pages).map((chunk) => ({
    content: chunk.content,
    pageNumber: chunk.pageNumber,
    sectionLabel: null,
    chapter: null,
    sectionTitle: null,
  }));
}

/** @deprecated Use extractPdfPages + splitPagesIntoChunks */
export async function extractPdfText(filePath: string): Promise<string> {
  const pages = await extractPdfPages(filePath);
  return pages.map((p) => p.text).join("\n\n");
}

export {
  convertLegacyFont,
  cleanMixedLegacy,
  convertLegacyTextFile,
  devanagariRatio,
} from "./legacy-font-convert";
