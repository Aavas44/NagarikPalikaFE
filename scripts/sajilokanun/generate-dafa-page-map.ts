import fs from "fs";
import path from "path";
import { extractPdfPages } from "../../src/lib/sajilokanun/pdf-extract";
import { LAWCOMISSION_INDEXING_RULES } from "../../src/lib/sajilokanun/indexing-rules/registry";
import { toArabicDigits } from "../../src/lib/sajilokanun/nepali-digits";

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

const BOOK_PDFS: Record<string, string> = {
  "civil-code": "मुलुकी_देवानी_(संहिता) ऐन,_२०७४.pdf",
  "criminal-code": "मुलुकी-अपराध-संहिता-ऐन-२०७४.pdf",
  "civil-procedure": "मुलुकी-देवानी-कार्यविधि-ऐन-२०७४.pdf",
  "criminal-procedure": "मुलुकी_फौजदारी_कार्यविधि_संहिता_२०७४(1).pdf",
};

function compact(text: string): string {
  return text
    .replace(/[\s।|,.:ः]+/g, "")
    .replace(/[m।नयख।लउ]/g, "")
    .toLowerCase();
}

function parseRootDafas(
  structuredText: string
): Array<{ num: string; title: string }> {
  const results: Array<{ num: string; title: string }> = [];
  for (const line of structuredText.split("\n")) {
    const match = line.match(/^([\d०-९]+)\.\s*(.+?)\s*[:ः]?\s*$/);
    if (!match) continue;
    const num = toArabicDigits(match[1]);
    const title = match[2].replace(/\s+/g, " ").trim();
    if (!title || !/^[\d]+$/.test(num)) continue;
    results.push({ num, title });
  }
  return results;
}

function isGenericDafaTitle(title: string): boolean {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (/^हदम्याद\s*[:ः]?$/u.test(normalized)) return true;
  // Many limitation clauses share the same boilerplate after the heading.
  if (/^हदम्याद\s*[:ः]?\s*यस परिच्छेद/u.test(normalized)) return true;
  if (compact(normalized).length < 14) return true;
  return false;
}

function findPageByTitle(
  pages: Awaited<ReturnType<typeof extractPdfPages>>,
  title: string
): number | null {
  const needles = [24, 18, 12]
    .map((len) => compact(title).slice(0, len))
    .filter((n) => n.length >= 10);

  for (const needle of needles) {
    for (const page of pages) {
      if (compact(page.text).includes(needle)) return page.pageNumber;
    }
  }
  return null;
}

function findPageByDafaNumber(
  pages: Awaited<ReturnType<typeof extractPdfPages>>,
  dafaNum: string,
  title: string
): number | null {
  const nepali = toArabicDigits(dafaNum);
  const display = nepali.replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)] ?? d);
  const titleNeedle = isGenericDafaTitle(title)
    ? ""
    : compact(title).slice(0, 16);

  for (const page of pages) {
    const text = page.text;
    const hasNumber = new RegExp(
      `(?:^|[\\s।|])${display}\\s*\\.|(?:^|[\\s।|])${nepali}\\s*\\.|(?:^|[\\s।|])${display}[\\.\\sः]|(?:^|[\\s।|])${nepali}[\\.\\sः]|दफा\\s*${display}|दफा\\s*${nepali}`
    ).test(text.replace(/\s+/g, " "));
    if (!hasNumber) continue;
    if (!titleNeedle || compact(text).includes(titleNeedle)) {
      return page.pageNumber;
    }
  }
  return null;
}

function findFirstPageMentioningDafa(
  pages: Awaited<ReturnType<typeof extractPdfPages>>,
  dafaNum: string
): number | null {
  const arabic = toArabicDigits(dafaNum);
  const nepali = arabic.replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)] ?? d);
  const re = new RegExp(
    `(?:^|[\\s।|])${nepali}\\s*\\.|(?:^|[\\s।|])${arabic}\\s*\\.|(?:^|[\\s।|])${nepali}[\\.\\sः]|(?:^|[\\s।|])${arabic}[\\.\\sः]|दफा\\s*${nepali}|दफा\\s*${arabic}`
  );

  for (const page of pages) {
    if (re.test(page.text.replace(/\s+/g, " "))) return page.pageNumber;
  }
  return null;
}

async function buildMapForBook(bookId: string, pdfRel: string, sourceText: string) {
  const structuredPath = path.join(
    LAWFILES_DIR,
    "lawComission",
    ".structured",
    path.basename(sourceText)
  );
  const structuredText = fs.readFileSync(structuredPath, "utf8");
  const dafas = parseRootDafas(structuredText);
  const pages = await extractPdfPages(path.join(LAWFILES_DIR, pdfRel));

  const map: Record<string, number> = {};
  for (const { num, title } of dafas) {
    const page =
      findPageByDafaNumber(pages, num, title) ??
      findFirstPageMentioningDafa(pages, num) ??
      (!isGenericDafaTitle(title) ? findPageByTitle(pages, title) : null);
    if (page != null) map[num] = page;
  }

  return { bookId, totalPages: pages.length, dafaCount: dafas.length, map };
}

async function main() {
  const outDir = path.join(process.cwd(), "src/data/sajilokanun/dafa-page-map");
  fs.mkdirSync(outDir, { recursive: true });

  for (const rule of LAWCOMISSION_INDEXING_RULES) {
    const pdfRel = BOOK_PDFS[rule.bookId ?? rule.id];
    if (!pdfRel) {
      console.warn(`No PDF configured for ${rule.id}`);
      continue;
    }
    console.log(`Building ${rule.id}...`);
    const { totalPages, dafaCount, map } = await buildMapForBook(
      rule.id,
      pdfRel,
      rule.sourceText
    );
    const overridePath = path.join(outDir, `${rule.id}.overrides.json`);
    if (fs.existsSync(overridePath)) {
      const overrides = JSON.parse(fs.readFileSync(overridePath, "utf8")) as {
        map?: Record<string, number>;
      };
      Object.assign(map, overrides.map ?? {});
    }
    const outPath = path.join(outDir, `${rule.id}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        { bookId: rule.id, pdf: `Lawfiles/${pdfRel}`, totalPages, dafaCount, map },
        null,
        2
      )
    );
    console.log(`  mapped ${Object.keys(map).length}/${dafaCount} dafas, ${totalPages} pages`);
    for (const sample of ["45", "285", "73", "14", "517", "254"]) {
      if (map[sample]) console.log(`  dafa ${sample} -> page ${map[sample]}`);
    }
  }
}

main().catch(console.error);
