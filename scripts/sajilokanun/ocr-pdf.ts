/**
 * OCR a PDF page-by-page with Gemini Vision.
 * Output: Lawfiles/.../ocr/<basename>/page-NNN.txt + manifest.json
 *
 * Usage:
 *   npm run ocr-pdf -- --file "refined/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.pdf"
 *   npm run ocr-pdf -- --file "..." --from 1 --to 3
 *   npm run ocr-pdf -- --file "..." --ingest   # OCR then ingest with --reingest
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import {
  hasOcrSidecar,
  loadOcrPages,
  ocrPdfToSidecar,
  ocrSidecarDir,
  readOcrManifest,
} from "../../src/lib/sajilokanun/pdf-ocr";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const relFile = getArg("file");
  if (!relFile) {
    console.error(
      'Usage: npm run ocr-pdf -- --file "refined/your.pdf" [--from 1] [--to 10] [--force] [--ingest]'
    );
    process.exit(1);
  }

  const provider = process.env.OCR_PROVIDER ?? "tesseract";
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when OCR_PROVIDER=gemini");
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when OCR_PROVIDER=openai");
  }

  const pdfPath = path.join(LAWFILES_DIR, relFile);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const fromPage = Number(getArg("from") ?? 1);
  const toArg = getArg("to");
  const toPage = toArg ? Number(toArg) : undefined;

  const sidecarDir = ocrSidecarDir(pdfPath);
  console.log(`OCR: ${relFile} (${provider})`);
  if (provider === "openai") {
    const model = process.env.OPENAI_OCR_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
    const mode = process.env.OPENAI_OCR_MODE === "vision" ? "vision" : "hybrid";
    console.log(
      `  Model: ${model} (${mode}) — ~$0.50–$2 for 144 pages with gpt-4o-mini`
    );
  }
  if (provider === "gemini") {
    const model = process.env.GEMINI_OCR_MODEL ?? process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";
    const mode = process.env.GEMINI_OCR_MODE === "vision" ? "vision" : "hybrid";
    const rpm = process.env.GEMINI_OCR_RPM ?? "15";
    console.log(
      `  Model: ${model} (${mode}) — free tier ~${rpm} RPM; 144 pages ≈ ${Math.ceil((144 * 60) / Number(rpm))} min`
    );
  }
  console.log(`Output: ${path.relative(process.cwd(), sidecarDir)}/`);

  const manifest = await ocrPdfToSidecar({
    pdfPath,
    fromPage,
    toPage,
    force: hasFlag("force"),
    onPage(pageNumber, text) {
      console.log(`    → ${text.replace(/\s+/g, " ").slice(0, 100)}…`);
    },
  });

  console.log(
    `\nDone: ${manifest.completedPages.length}/${manifest.totalPages} pages in sidecar`
  );

  const sample = loadOcrPages(pdfPath).find((p) => p.pageNumber === fromPage);
  if (sample) {
    console.log(`\nSample (page ${fromPage}):\n${sample.text.slice(0, 400)}`);
  }

  if (hasFlag("ingest")) {
    console.log("\nRunning ingest with OCR sidecar…");
    const { spawnSync } = await import("child_process");
    const result = spawnSync(
      "npm",
      ["run", "ingest", "--", "--file", relFile, "--reingest"],
      { stdio: "inherit", cwd: process.cwd(), env: process.env }
    );
    process.exit(result.status ?? 1);
  }

  if (manifest.completedPages.length < manifest.totalPages) {
    console.log(
      `\nResume later:\n  npm run ocr-pdf -- --file "${relFile}" --from ${manifest.completedPages.length + 1}`
    );
  } else if (!hasFlag("ingest")) {
    console.log(
      `\nIngest OCR text:\n  npm run ingest -- --file "${relFile}" --reingest`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
