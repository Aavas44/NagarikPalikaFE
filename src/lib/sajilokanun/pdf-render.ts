import fs from "fs";
import { createCanvas, Path2D, ImageData } from "@napi-rs/canvas";
import DOMMatrixShim from "@thednp/dommatrix";

// pdfjs-dist expects browser globals in Node
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixShim as typeof globalThis.DOMMatrix;
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = Path2D as typeof globalThis.Path2D;
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = ImageData as typeof globalThis.ImageData;
}

type PdfJsModule = {
  getDocument: (params: Record<string, unknown>) => {
    promise: Promise<PdfDocument>;
  };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: unknown;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

type CanvasLike = {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
};

type CanvasAndContext = {
  canvas: CanvasLike;
  context: unknown;
};

/** Avoid pdfjs NodeCanvasFactory (needs Node 20+ getBuiltinModule). */
class NapiCanvasFactory {
  constructor(_opts: { ownerDocument?: unknown; enableHWA?: boolean }) {}

  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height)) as unknown as CanvasLike;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create 2D context");
    }
    return { canvas, context };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    canvasAndContext.canvas.width = Math.ceil(width);
    canvasAndContext.canvas.height = Math.ceil(height);
  }

  destroy(canvasAndContext: CanvasAndContext): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

let pdfjs: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjs) {
    pdfjs = (await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    )) as unknown as PdfJsModule;
  }
  return pdfjs;
}

async function openPdfDocument(pdfPath: string) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const { getDocument } = await loadPdfJs();
  return getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    CanvasFactory: NapiCanvasFactory,
  }).promise;
}

export async function renderPdfPageToPng(
  pdfPath: string,
  pageNumber: number,
  scale = 2
): Promise<Buffer> {
  const doc = await openPdfDocument(pdfPath);
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height)
  );
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create render context");
  }

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toBuffer("image/png");
}

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const doc = await openPdfDocument(pdfPath);
  return doc.numPages;
}
