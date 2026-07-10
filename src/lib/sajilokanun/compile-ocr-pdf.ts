import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import {
  ocrImagePath,
  ocrPagePath,
  ocrSidecarDir,
  readOcrManifest,
} from "./pdf-ocr";

export type CompileOcrPdfOptions = {
  sourcePdfPath: string;
  outputPath?: string;
  mode?: "text" | "image";
  fontPath?: string;
  fontSize?: number;
};

function defaultOutputPath(sourcePdfPath: string, mode: "text" | "image"): string {
  const base = path.basename(sourcePdfPath, path.extname(sourcePdfPath));
  const suffix = mode === "image" ? " (scan)" : " (OCR)";
  return path.join(path.dirname(sourcePdfPath), `${base}${suffix}.pdf`);
}

function listOcrPages(sidecarDir: string, totalPages: number): number[] {
  const pages: number[] = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    pages.push(pageNumber);
  }
  return pages;
}

async function writePdf(doc: InstanceType<typeof PDFDocument>, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

export async function compileOcrTextPdf(
  options: CompileOcrPdfOptions
): Promise<string> {
  const {
    sourcePdfPath,
    fontPath = path.join(process.cwd(), "fonts/kalimati-regular.otf"),
    fontSize = 9,
  } = options;

  const sidecarDir = ocrSidecarDir(sourcePdfPath);
  const manifest = readOcrManifest(sidecarDir);
  if (!manifest) {
    throw new Error(`OCR sidecar not found for ${sourcePdfPath}`);
  }

  const outputPath =
    options.outputPath ?? defaultOutputPath(sourcePdfPath, "text");
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    autoFirstPage: false,
    info: {
      Title: manifest.sourcePdf.replace(/\.pdf$/i, ""),
      Producer: "HandyLaw OCR compile",
    },
  });

  doc.registerFont("kalimati", fontPath);

  for (const pageNumber of listOcrPages(sidecarDir, manifest.totalPages)) {
    const text = fs.readFileSync(
      ocrPagePath(sidecarDir, pageNumber),
      "utf8"
    ).trim();
    if (!text) continue;

    doc.addPage();
    doc
      .font("kalimati")
      .fontSize(fontSize)
      .fillColor("#111111")
      .text(text, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "left",
        lineGap: 2,
      });
  }

  await writePdf(doc, outputPath);
  return outputPath;
}

export async function compileOcrImagePdf(
  options: CompileOcrPdfOptions
): Promise<string> {
  const { sourcePdfPath } = options;
  const sidecarDir = ocrSidecarDir(sourcePdfPath);
  const manifest = readOcrManifest(sidecarDir);
  if (!manifest) {
    throw new Error(`OCR sidecar not found for ${sourcePdfPath}`);
  }

  const { PDFDocument: PdfLibDocument } = await import("pdf-lib");
  const outputPath =
    options.outputPath ?? defaultOutputPath(sourcePdfPath, "image");

  const pdfDoc = await PdfLibDocument.create();
  pdfDoc.setTitle(manifest.sourcePdf.replace(/\.pdf$/i, ""));
  pdfDoc.setProducer("HandyLaw OCR compile");

  for (const pageNumber of listOcrPages(sidecarDir, manifest.totalPages)) {
    const imageFile = ocrImagePath(sidecarDir, pageNumber);
    if (!fs.existsSync(imageFile)) {
      throw new Error(`Missing OCR image: ${imageFile}`);
    }

    const pngBytes = fs.readFileSync(imageFile);
    const image = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await pdfDoc.save());
  return outputPath;
}

export async function compileOcrPdf(
  options: CompileOcrPdfOptions
): Promise<string> {
  const mode = options.mode ?? "text";
  return mode === "image"
    ? compileOcrImagePdf(options)
    : compileOcrTextPdf(options);
}
