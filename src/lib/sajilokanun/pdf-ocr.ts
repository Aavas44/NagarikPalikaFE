import fs from "fs";
import path from "path";
import { createWorker, type Worker } from "tesseract.js";
import {
  getGemini,
  GEMINI_OCR_MODEL,
  geminiOcrIntervalMs,
  isQuotaError as isGeminiQuotaError,
  waitForGeminiOcrSlot,
} from "./gemini";
import {
  OCR_MODEL as OPENAI_OCR_MODEL,
  isQuotaError as isOpenAiQuotaError,
  transcribeImage,
} from "./openai";
import { cleanNepaliText } from "./text-clean";
import { getPdfPageCount, renderPdfPageToPng } from "./pdf-render";
import { extractRawPdfPages } from "./pdf-raw";
import type { PdfPage } from "./pdf-extract";

export type OcrProvider = "tesseract" | "gemini" | "openai";

export function getOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER ?? "tesseract";
  if (provider === "openai") return "openai";
  if (provider === "gemini") return "gemini";
  return "tesseract";
}

function isQuotaError(error: unknown): boolean {
  return isOpenAiQuotaError(error) || isGeminiQuotaError(error);
}

function ocrModelLabel(provider: OcrProvider): string {
  if (provider === "openai") return OPENAI_OCR_MODEL;
  if (provider === "gemini") {
    const mode = useHybridGeminiOcr() ? "hybrid" : "vision";
    return `${GEMINI_OCR_MODEL} (${mode})`;
  }
  return `tesseract:${process.env.OCR_TESSERACT_LANGS ?? "nep+eng"}`;
}

export function useHybridGeminiOcr(): boolean {
  return process.env.GEMINI_OCR_MODE !== "vision";
}

function defaultOcrDelayMs(provider: OcrProvider): number {
  if (process.env.OCR_DELAY_MS !== undefined) {
    return Number(process.env.OCR_DELAY_MS);
  }
  if (provider === "gemini") {
    return 0;
  }
  return 500;
}

const OCR_PROMPT = `Transcribe this page from a Nepali legal statute (Muluki Ain) in Devanagari Unicode.

Rules:
- Transcribe all Nepali legal text exactly as printed
- Use correct Devanagari matras with NO spaces inside words (e.g. "मुद्दाको" not "म ु द्द ा क ो")
- Preserve दफा numbers, subsection markers like (१), (२), परिच्छेद headings, and punctuation (। , —)
- Preserve Nepali numerals (०–९) as printed
- Skip repeated website footers (www.lawcommission.gov.np) and bare page numbers
- Do not translate, summarize, or add commentary
- Return ONLY plain Nepali text — no markdown`;

function hybridOcrPrompt(rawPageText: string, pageNumber: number): string {
  return `Correct this Nepali legal statute page using the attached image.

The PDF text extraction below has broken spacing and wrong characters. Produce clean Devanagari Unicode matching the printed page.

Rules:
- Fix spacing inside words and wrong matras/consonants only
- Preserve दफा numbers, (१)(२), परिच्छेद, Nepali numerals ०–९, punctuation ।
- Do not summarize, translate, or omit provisions
- Skip www.lawcommission.gov.np footers and bare page numbers
- Return ONLY corrected Nepali text — no markdown

Page ${pageNumber} noisy extraction:
${rawPageText.trim()}`;
}

function normalizeOcrResponse(text: string): string {
  return text
    .replace(/^```(?:[a-z]+\n)?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

export function useHybridOpenAiOcr(): boolean {
  return process.env.OPENAI_OCR_MODE !== "vision";
}

export type OcrManifest = {
  sourcePdf: string;
  totalPages: number;
  completedPages: number[];
  model: string;
  scale: number;
  provider: OcrProvider;
  updatedAt: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isQuotaError(error) || attempt === maxAttempts) throw error;
      const waitMs = Math.min(2000 * 2 ** (attempt - 1), 60000);
      console.warn(
        `  Rate limited on ${label}, retry in ${Math.round(waitMs / 1000)}s`
      );
      await sleep(waitMs);
    }
  }
  throw new Error(`Failed ${label}`);
}

export function ocrSidecarDir(pdfPath: string): string {
  const base = path.basename(pdfPath, path.extname(pdfPath));
  return path.join(path.dirname(pdfPath), "ocr", base);
}

export function ocrPagePath(sidecarDir: string, pageNumber: number): string {
  return path.join(sidecarDir, `page-${String(pageNumber).padStart(3, "0")}.txt`);
}

export function ocrImagePath(sidecarDir: string, pageNumber: number): string {
  return path.join(sidecarDir, `page-${String(pageNumber).padStart(3, "0")}.png`);
}

export function ocrManifestPath(sidecarDir: string): string {
  return path.join(sidecarDir, "manifest.json");
}

export function readOcrManifest(sidecarDir: string): OcrManifest | null {
  const manifestFile = ocrManifestPath(sidecarDir);
  if (!fs.existsSync(manifestFile)) return null;
  return JSON.parse(fs.readFileSync(manifestFile, "utf8")) as OcrManifest;
}

export function writeOcrManifest(sidecarDir: string, manifest: OcrManifest): void {
  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.writeFileSync(ocrManifestPath(sidecarDir), JSON.stringify(manifest, null, 2));
}

export function readOcrPage(sidecarDir: string, pageNumber: number): string | null {
  const pageFile = ocrPagePath(sidecarDir, pageNumber);
  if (!fs.existsSync(pageFile)) return null;
  return fs.readFileSync(pageFile, "utf8");
}

export function writeOcrPage(
  sidecarDir: string,
  pageNumber: number,
  text: string
): void {
  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.writeFileSync(ocrPagePath(sidecarDir, pageNumber), text, "utf8");
}

export function hasOcrSidecar(pdfPath: string): boolean {
  const dir = ocrSidecarDir(pdfPath);
  const manifest = readOcrManifest(dir);
  return Boolean(manifest && manifest.completedPages.length > 0);
}

export function loadOcrPages(pdfPath: string, totalPages?: number): PdfPage[] {
  const dir = ocrSidecarDir(pdfPath);
  const manifest = readOcrManifest(dir);
  if (!manifest) return [];

  const limit = totalPages ?? manifest.totalPages;
  const pages: PdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
    const raw = readOcrPage(dir, pageNumber);
    if (!raw?.trim()) continue;
    pages.push({
      pageNumber,
      text: cleanNepaliText(raw),
    });
  }

  return pages;
}

let tesseractWorker: Worker | null = null;

async function getTesseractWorker(): Promise<Worker> {
  if (!tesseractWorker) {
    const langs = process.env.OCR_TESSERACT_LANGS ?? "nep+eng";
    tesseractWorker = await createWorker(langs);
  }
  return tesseractWorker;
}

export async function terminateOcrWorkers(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

export async function ocrPageImageTesseract(imageBuffer: Buffer): Promise<string> {
  const worker = await getTesseractWorker();
  const { data } = await worker.recognize(imageBuffer);
  return data.text.trim();
}

export async function ocrPageImageGemini(
  imageBuffer: Buffer,
  pageNumber: number,
  rawPageText?: string
): Promise<string> {
  const base64 = imageBuffer.toString("base64");
  const prompt =
    useHybridGeminiOcr() && rawPageText?.trim()
      ? hybridOcrPrompt(rawPageText, pageNumber)
      : `${OCR_PROMPT}\n\nPage ${pageNumber}:`;

  await waitForGeminiOcrSlot();

  const response = await withRetry(
    () =>
      getGemini().models.generateContent({
        model: GEMINI_OCR_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0,
          maxOutputTokens: 8192,
        },
      }),
    `ocr-page-${pageNumber}`
  );

  const text = normalizeOcrResponse(response.text?.trim() ?? "");
  if (!text) {
    throw new Error(`Empty OCR result for page ${pageNumber}`);
  }

  return text;
}

export async function ocrPageImageOpenai(
  imageBuffer: Buffer,
  pageNumber: number,
  rawPageText?: string
): Promise<string> {
  const prompt =
    useHybridOpenAiOcr() && rawPageText?.trim()
      ? hybridOcrPrompt(rawPageText, pageNumber)
      : `${OCR_PROMPT}\n\nPage ${pageNumber}:`;

  const text = await transcribeImage(
    imageBuffer,
    prompt,
    `ocr-page-${pageNumber}`
  );
  return normalizeOcrResponse(text);
}

export async function ocrPageImage(
  imageBuffer: Buffer,
  pageNumber: number,
  provider = getOcrProvider(),
  rawPageText?: string
): Promise<string> {
  if (provider === "openai") {
    return ocrPageImageOpenai(imageBuffer, pageNumber, rawPageText);
  }
  if (provider === "gemini") {
    try {
      return await ocrPageImageGemini(imageBuffer, pageNumber, rawPageText);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      if (process.env.GEMINI_OCR_FALLBACK !== "tesseract") throw error;
      console.warn("  Gemini quota hit — falling back to Tesseract");
      return ocrPageImageTesseract(imageBuffer);
    }
  }
  return ocrPageImageTesseract(imageBuffer);
}

export type OcrPdfOptions = {
  pdfPath: string;
  scale?: number;
  fromPage?: number;
  toPage?: number;
  delayMs?: number;
  force?: boolean;
  onPage?: (pageNumber: number, text: string) => void;
};

export async function ocrPdfToSidecar(options: OcrPdfOptions): Promise<OcrManifest> {
  const {
    pdfPath,
    scale = 2,
    fromPage = 1,
    toPage,
    delayMs,
    force = false,
    onPage,
  } = options;

  const sidecarDir = ocrSidecarDir(pdfPath);
  fs.mkdirSync(sidecarDir, { recursive: true });

  const existing = readOcrManifest(sidecarDir);
  const completed = new Set(existing?.completedPages ?? []);
  const totalPages =
    existing?.totalPages ?? (await getPdfPageCount(pdfPath));
  const lastPage = Math.min(
    toPage ?? totalPages,
    totalPages
  );
  const startPage = Math.max(fromPage, 1);

  const provider = getOcrProvider();
  const resolvedDelayMs = delayMs ?? defaultOcrDelayMs(provider);
  const rawPages =
    (provider === "openai" && useHybridOpenAiOcr()) ||
    (provider === "gemini" && useHybridGeminiOcr())
      ? await extractRawPdfPages(pdfPath)
      : null;

  if (provider === "gemini") {
    const rpm = Number(process.env.GEMINI_OCR_RPM ?? 15);
    const intervalSec = (geminiOcrIntervalMs() / 1000).toFixed(1);
    const estMin = ((lastPage - startPage + 1) * geminiOcrIntervalMs()) / 60_000;
    console.log(
      `  Gemini rate limit: ~${rpm} RPM (${intervalSec}s between requests, ~${estMin.toFixed(0)} min for this run)`
    );
  }

  if (
    existing &&
    existing.provider !== provider &&
    !force &&
    completed.size > 0
  ) {
    console.warn(
      `  Sidecar was OCR'd with ${existing.provider}; use --force to re-run with ${provider}`
    );
  }

  for (let pageNumber = startPage; pageNumber <= lastPage; pageNumber++) {
    if (completed.has(pageNumber) && !force) {
      console.log(`  Page ${pageNumber}/${totalPages} — cached`);
      continue;
    }

    const imageFile = ocrImagePath(sidecarDir, pageNumber);
    let image: Buffer;
    if (fs.existsSync(imageFile)) {
      image = fs.readFileSync(imageFile);
      console.log(`  Page ${pageNumber}/${totalPages} — using cached PNG`);
    } else {
      console.log(`  Page ${pageNumber}/${totalPages} — rendering…`);
      image = await renderPdfPageToPng(pdfPath, pageNumber, scale);
      fs.writeFileSync(imageFile, image);
    }

    console.log(`  Page ${pageNumber}/${totalPages} — OCR (${provider}${rawPages ? ", hybrid" : ""})…`);
    const raw = await ocrPageImage(
      image,
      pageNumber,
      provider,
      rawPages?.[pageNumber - 1]
    );
    const cleaned = cleanNepaliText(raw);
    writeOcrPage(sidecarDir, pageNumber, cleaned);
    completed.add(pageNumber);
    onPage?.(pageNumber, cleaned);

    const manifest: OcrManifest = {
      sourcePdf: path.basename(pdfPath),
      totalPages,
      completedPages: [...completed].sort((a, b) => a - b),
      model: ocrModelLabel(provider),
      scale,
      provider,
      updatedAt: new Date().toISOString(),
    };
    writeOcrManifest(sidecarDir, manifest);

    if (resolvedDelayMs > 0 && pageNumber < lastPage) {
      await sleep(resolvedDelayMs);
    }
  }

  const finalManifest: OcrManifest = {
    sourcePdf: path.basename(pdfPath),
    totalPages,
    completedPages: [...completed].sort((a, b) => a - b),
    model: ocrModelLabel(provider),
    scale,
    provider,
    updatedAt: new Date().toISOString(),
  };
  writeOcrManifest(sidecarDir, finalManifest);
  await terminateOcrWorkers();
  return finalManifest;
}
