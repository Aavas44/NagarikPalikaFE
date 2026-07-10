/**
 * Apply Latin OCR fixes to sidecar page-*.txt files (in place).
 */
import fs from "fs";
import path from "path";
import { cleanNepaliText } from "../../src/lib/sajilokanun/text-clean";
import { fixLatinOcrArtifacts } from "../../src/lib/sajilokanun/latin-ocr-fix";

const LAWFILES = path.join(process.cwd(), "Lawfiles");

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function countLatinWords(text: string): number {
  const matches = text.match(/(?<![A-Za-z])[A-Za-z]{2,}(?![A-Za-z])/g);
  return matches?.length ?? 0;
}

function main() {
  const relFile = getArg("file");
  if (!relFile) {
    console.error('Usage: npm run fix-ocr-latin -- --file "refined/your.pdf"');
    process.exit(1);
  }

  const pdfPath = path.join(LAWFILES, relFile);
  const base = path.basename(pdfPath, path.extname(pdfPath));
  const sidecarDir = path.join(path.dirname(pdfPath), "ocr", base);

  if (!fs.existsSync(sidecarDir)) {
    throw new Error(`OCR sidecar not found: ${sidecarDir}`);
  }

  const pages = fs
    .readdirSync(sidecarDir)
    .filter((f) => /^page-\d+\.txt$/.test(f))
    .sort();

  let beforeTotal = 0;
  let afterTotal = 0;

  for (const pageFile of pages) {
    const filePath = path.join(sidecarDir, pageFile);
    const raw = fs.readFileSync(filePath, "utf8");
    beforeTotal += countLatinWords(raw);
    const fixed = cleanNepaliText(fixLatinOcrArtifacts(raw));
    afterTotal += countLatinWords(fixed);
    fs.writeFileSync(filePath, fixed, "utf8");
  }

  console.log(`Fixed ${pages.length} OCR pages in ${sidecarDir}`);
  console.log(`Latin tokens: ${beforeTotal} → ${afterTotal}`);
}

main();
