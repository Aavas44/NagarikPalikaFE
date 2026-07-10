import fs from "fs";
import pdf from "pdf-parse";

const DEVANAGARI_RE = /[\u0900-\u097F]/g;

function devanagariRatio(text: string): number {
  const matches = text.match(DEVANAGARI_RE);
  return (matches?.length ?? 0) / Math.max(text.length, 1);
}

/** Raw per-page text from PDF text layer (no OCR sidecar, no cleanup). */
export async function extractRawPdfPages(filePath: string): Promise<string[]> {
  const buffer = fs.readFileSync(filePath);
  const pages: string[] = [];

  await pdf(buffer, {
    pagerender(pageData: {
      getTextContent: () => Promise<{ items: { str?: string }[] }>;
    }) {
      return pageData.getTextContent().then((textContent) => {
        const raw = textContent.items.map((item) => item.str ?? "").join(" ");
        pages.push(raw);
        return `${raw}\n`;
      });
    },
  });

  return pages;
}

export async function extractRawPdfPage(
  filePath: string,
  pageNumber: number
): Promise<string> {
  const pages = await extractRawPdfPages(filePath);
  return pages[pageNumber - 1] ?? "";
}

export { devanagariRatio };
