/**
 * Extract दफा number + title lines from .structured law files → src/data/sajilokanun/dafa-taxonomy/*.json
 * Usage: npx tsx scripts/generate-dafa-name-taxonomy.ts
 */
import fs from "fs";
import path from "path";
import { toArabicDigits } from "../../src/lib/sajilokanun/nepali-digits";
import type { NormalizeActId } from "../../src/lib/sajilokanun/dafa-name-taxonomy";

const ROOT = path.resolve(__dirname, "..");
const STRUCTURED_DIR = path.join(ROOT, "Lawfiles/lawComission/.structured");
const OUT_DIR = path.join(ROOT, "src/data/sajilokanun/dafa-taxonomy");

const BOOK_FILES: Record<NormalizeActId, string> = {
  devani: "मुलुकी देवानी संहिता, २०७४.txt",
  devani_karyavidhi: "मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
  aparadh: "मुलुकी अपराध संहिता, २०७४.txt",
  faujdari_karyavidhi: "मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
};

const ACT_ENGLISH: Record<NormalizeActId, string> = {
  devani: "Muluki Devani Samhita 2074",
  devani_karyavidhi: "Muluki Devani Karyavidhi Samhita 2074",
  aparadh: "Muluki Aparadh Samhita 2074",
  faujdari_karyavidhi: "Muluki Faujdari Karyavidhi Samhita 2074",
};

const BOOK_ID: Record<NormalizeActId, string> = {
  devani: "civil-code",
  devani_karyavidhi: "civil-procedure",
  aparadh: "criminal-code",
  faujdari_karyavidhi: "criminal-procedure",
};

/** Top-level दफा line in .structured files (not indented उपदफा). */
const DAFA_LINE = /^([\d०-९]+[क-ह]?)\.\s*(.+)$/u;

export type DafaTaxonomyEntry = {
  label: string;
  title: string;
  displayLine: string;
  sectionRoot: number;
};

export type DafaTaxonomyFile = {
  bookId: string;
  act: string;
  normalizeActId: NormalizeActId;
  sourceFile: string;
  generatedAt: string;
  entryCount: number;
  entries: DafaTaxonomyEntry[];
};

function trimTitle(raw: string): string {
  let title = raw.trim();
  const visarga = title.indexOf("ः");
  if (visarga > 0 && visarga < 160) {
    title = title.slice(0, visarga + 1).trim();
  } else if (title.length > 120) {
    title = `${title.slice(0, 117).trim()}…`;
  }
  return title;
}

function sectionRootFromLabel(label: string): number {
  const digits = label.replace(/[क-ह]$/u, "");
  const n = Number(toArabicDigits(digits));
  return Number.isFinite(n) ? n : 0;
}

function extractEntries(text: string): DafaTaxonomyEntry[] {
  const entries: DafaTaxonomyEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || /^\s/.test(line)) continue;
    if (/^भाग\s|^परिच्छेद\s/u.test(line.trim())) continue;

    const match = line.trim().match(DAFA_LINE);
    if (!match) continue;

    const label = match[1].trim();
    const title = trimTitle(match[2]);
    const displayLine = `${label}. ${title}`;
    entries.push({
      label,
      title,
      displayLine,
      sectionRoot: sectionRootFromLabel(label),
    });
  }
  return entries;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  for (const [normalizeActId, filename] of Object.entries(BOOK_FILES) as [
    NormalizeActId,
    string,
  ][]) {
    const sourcePath = path.join(STRUCTURED_DIR, filename);
    const text = fs.readFileSync(sourcePath, "utf-8");
    const entries = extractEntries(text);
    const payload: DafaTaxonomyFile = {
      bookId: BOOK_ID[normalizeActId],
      act: ACT_ENGLISH[normalizeActId],
      normalizeActId,
      sourceFile: filename,
      generatedAt,
      entryCount: entries.length,
      entries,
    };
    const outPath = path.join(OUT_DIR, `${BOOK_ID[normalizeActId]}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    console.log(`${BOOK_ID[normalizeActId]}: ${entries.length} दफा → ${outPath}`);
  }
}

main();
