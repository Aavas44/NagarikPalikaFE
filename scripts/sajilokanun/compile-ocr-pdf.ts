/**
 * Compile OCR sidecar pages into a single PDF in Lawfiles/refined/.
 *
 * Usage:
 *   npm run compile-ocr-pdf -- --file "refined/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.pdf"
 *   npm run compile-ocr-pdf -- --file "refined/..." --mode image
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { compileOcrPdf } from "../../src/lib/sajilokanun/compile-ocr-pdf";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

async function main() {
  const relFile = getArg("file");
  if (!relFile) {
    console.error(
      'Usage: npm run compile-ocr-pdf -- --file "refined/your.pdf" [--mode text|image] [--out name.pdf]'
    );
    process.exit(1);
  }

  const sourcePdfPath = path.join(LAWFILES_DIR, relFile);
  if (!fs.existsSync(sourcePdfPath)) {
    throw new Error(`PDF not found: ${sourcePdfPath}`);
  }

  const modeArg = getArg("mode");
  const mode = modeArg === "image" ? "image" : "text";
  const outArg = getArg("out");
  const outputPath = outArg
    ? path.join(path.dirname(sourcePdfPath), outArg)
    : undefined;

  console.log(`Compiling OCR ${mode} PDF…`);
  const result = await compileOcrPdf({ sourcePdfPath, outputPath, mode });
  const stats = fs.statSync(result);
  console.log(`Written: ${path.relative(process.cwd(), result)}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
