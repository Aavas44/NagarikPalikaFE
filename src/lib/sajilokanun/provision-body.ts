import {
  parseSectionLabelFromContent,
} from "./chunk-metadata";
import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";

function sectionNumberVariants(sectionNumber: string): string[] {
  const arabic = toArabicDigits(sectionNumber);
  const nepali = toNepaliNumberDisplay(arabic);
  return [...new Set([sectionNumber, arabic, nepali])];
}

/** Remove leading "५०. शीर्षक:" line when metadata already names the दफा. */
export function stripLeadingSectionHeading(
  body: string,
  sectionNumber?: string | null
): string {
  if (!body.trim() || !sectionNumber) return body;

  let result = body;
  for (const num of sectionNumberVariants(sectionNumber)) {
    const escaped = num.replace(/\./g, "\\.");
    const patterns = [
      new RegExp(`^\\s*${escaped}\\.\\s*[^\\n]*?[ः:]\\s*`, "u"),
      new RegExp(`^\\s*${escaped}\\.\\s*[^\\n]+\\n+`, "u"),
    ];
    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, "").trim();
        break;
      }
    }
  }
  return result;
}

const HEADER_LINE =
  /^(?:पुस्तक|भाग|परिच्छेद|दफा|उपदफा|खण्ड|प्रकार|पृष्ठ)\s*:/;

function provisionBodyStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "" && i > 0) {
      return i + 1;
    }
  }

  for (let i = 1; i < lines.length; i++) {
    if (!HEADER_LINE.test(lines[i].trim())) {
      return i;
    }
  }

  return 1;
}

/** Body text for display/LLM context — skips chunk header block and repeated section title. */
export function getProvisionBody(content: string): string {
  const lines = content.split("\n");
  const bodyStart = provisionBodyStart(lines);
  const rawBody = lines.slice(bodyStart).join("\n").trim() || content.trim();
  const sectionNumber = parseSectionLabelFromContent(content);
  return stripLeadingSectionHeading(rawBody, sectionNumber);
}

/** Trim OCR bleed from the next दफा merged into chunk tail. */
export function cleanProvisionBodyForDisplay(body: string): string {
  return body
    .replace(/\s*s\}b[\s\S]*$/u, "")
    .replace(/\.\s*[\d०-९]+\.\s+[^\n(]*[\s\S]*$/u, "")
    .trim();
}

const QUERY_TERM_STOPWORDS = new Set([
  "को",
  "का",
  "की",
  "गर्दा",
  "गर्न",
  "गरे",
  "गर्ने",
  "गर्नु",
  "गर्नुपर्ने",
  "भए",
  "छ",
  "कुन",
  "दफा",
  "उपदफा",
  "मा",
  "मात्र",
  "समय",
  "नियम",
  "व्यवस्था",
  "सम्बन्ध",
  "अनुसार",
  "हुने",
  "हुन",
  "पर्ने",
  "पर्छ",
  "सक्ने",
  "सकिने",
  "अधिकारी",
  "अनुसन्धान",
]);

function queryMatchTerms(query: string): string[] {
  return [
    ...new Set(
      [...query.matchAll(/[\u0900-\u097F]{3,}/gu)]
        .map((m) => m[0])
        .filter((t) => !QUERY_TERM_STOPWORDS.has(t))
    ),
  ];
}

function scoreTextAgainstQuery(text: string, queryTerms: string[]): number {
  let score = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) score += term.length;
  }
  return score;
}

/**
 * Extract exactly the specified उपदफा by number from a section body.
 * Returns the original body if the target upadafa can't be isolated.
 */
export function extractExactUpadafa(
  body: string,
  upadafaNum: string
): string {
  const trimmed = body.trim();
  if (!trimmed) return body;

  const nepali = toNepaliNumberDisplay(upadafaNum);
  const arabic = toArabicDigits(upadafaNum);

  const startPattern = new RegExp(
    `^\\((${nepali}|${arabic})\\)\\s`,
    "mu"
  );
  const startMatch = trimmed.match(startPattern);
  if (!startMatch) return body;

  const startIdx = trimmed.indexOf(startMatch[0]);
  const afterStart = trimmed.slice(startIdx);

  const nextNum = parseInt(arabic, 10) + 1;
  const nextNepali = toNepaliNumberDisplay(String(nextNum));
  const endPattern = new RegExp(
    `^\\((${nextNepali}|${nextNum})\\)\\s`,
    "mu"
  );
  const endMatch = afterStart.match(endPattern);
  const segment = endMatch
    ? afterStart.slice(0, afterStart.indexOf(endMatch[0])).trim()
    : afterStart.trim();

  return segment || body;
}

const TOP_UPADAFA_COUNT = 3;
const ANCHOR_UPADAFA_COUNT = 2;
const NUMBERED_UPADAFA_START = /^\s*\([\d०-९]+\)\s/m;

function isNumberedUpadafaPart(text: string): boolean {
  return NUMBERED_UPADAFA_START.test(text);
}

/** True when body is already merged/formatted with statute clause markers. */
export function isHierarchicallyFormattedProvisionBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (/^दफा\s*:/m.test(trimmed) || /^पुस्तक\s*:/m.test(trimmed)) return true;
  const numbered = trimmed.match(/^\([\d०-९]+\)\s/gm) ?? [];
  const khanda = trimmed.match(/^\s*\([क-ज्ञ]\)\s/gm) ?? [];
  return numbered.length >= 2 || (numbered.length >= 1 && khanda.length >= 1);
}

function isPropertyArsonQuery(query: string): boolean {
  return /आग[ोज]?/u.test(query) && /घर|सम्पत्ति/u.test(query);
}

function extractInlineKhanda(
  text: string,
  khanda: string
): string | null {
  const re = new RegExp(
    `\\(\\s*${khanda}\\s*\\)\\s*([\\s\\S]*?)(?=\\(\\s*[क-ज्ञ]\\s*\\)|$)`,
    "u"
  );
  const match = text.match(re);
  return match?.[1]?.trim() ?? null;
}

/** Strip catch-all (ङ) tail when (घ) and (ङ) were merged onto one display line. */
function isolateGhKhandaLine(line: string): string {
  const marker = line.match(/^(\s*)\(\s*घ\s*\)\s*/u);
  if (!marker) return line;

  const indent = marker[1] ?? "";
  const afterGh = line.slice(marker[0].length);
  const ngaTail = afterGh.search(/,\s*\(\s*ङ\s*\)\s+/u);
  const ghText =
    ngaTail >= 0 ? afterGh.slice(0, ngaTail).replace(/,\s*$/, "").trim() : afterGh.trim();

  return `${indent}(घ) ${ghText}`;
}

/** For दफा २८५ house/property arson — keep (३)(घ) punishment, not (३)(क) wildlife. */
export function focusArsonPunishmentInSectionBody(
  body: string,
  query: string
): string {
  if (!isPropertyArsonQuery(query)) return body;
  if (!/आपराधिक उपद्रव|दफा\s*[:：]?\s*२८५/u.test(body)) return body;

  const lines = body.split("\n");
  const out: string[] = [];
  let inUpadafa3 = false;
  let keptUpadafa3Header = false;
  let keptGh = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const numbered = trimmed.match(/^\(([\d०-९]+)\)\s/u);
    if (numbered) {
      const num = toArabicDigits(numbered[1]);
      inUpadafa3 = num === "3";
      if (inUpadafa3) {
        if (/सजाय\s+हुनेछ|देहाय\s+बमोजिम/u.test(trimmed)) {
          out.push(line);
          keptUpadafa3Header = true;
        }
        continue;
      }
      inUpadafa3 = false;
      out.push(line);
      continue;
    }

    const khanda = trimmed.match(/^\(([क-ज्ञ])\)\s/u);
    if (inUpadafa3 && khanda) {
      const marker = khanda[1];
      if (marker === "घ" && /घर|सम्पत्ति/u.test(trimmed) && /आगो/u.test(trimmed)) {
        const ghOnly = isolateGhKhandaLine(line.startsWith("    ") ? line : `    ${trimmed}`);
        out.push(ghOnly);
        keptGh = true;
      }
      continue;
    }

    if (!inUpadafa3) {
      out.push(line);
    }
  }

  if (keptGh) return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Monolithic (३) paragraph with inline khandas — extract (घ) only.
  const upadafa3Match = body.match(
    /\(([\d०-९]+)\)\s*([^\n]*सजाय\s+हुनेछ[^\n]*)([\s\S]*)/u
  );
  if (!upadafa3Match || toArabicDigits(upadafa3Match[1]) !== "3") return body;

  const ghText = extractInlineKhanda(upadafa3Match[0], "घ");
  if (!ghText || !/घर|सम्पत्ति/u.test(ghText)) return body;

  const header = `(${toNepaliNumberDisplay("3")}) ${upadafa3Match[2].replace(/^\([\d०-९]+\)\s*/, "").trim()}`;
  const before = body.slice(0, body.indexOf(upadafa3Match[0])).trimEnd();
  const afterMatch = body.slice(body.indexOf(upadafa3Match[0]) + upadafa3Match[0].length);
  const afterUpadafa4 = afterMatch.match(/^\s*\(([\d०-९]+)\)/u);
  const tail =
    afterUpadafa4 && toArabicDigits(afterUpadafa4[1]) === "4"
      ? afterMatch.slice(afterMatch.indexOf(afterUpadafa4[0])).trim()
      : "";

  return [
    before,
    header,
    `    (घ) ${ghText}`,
    tail,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/** Advocate verbatim block: preserve hierarchy; trim only flat OCR bodies. */
export function formatAdvocateProvisionBody(body: string, query: string): string {
  const trimmed = body.trim();
  if (!trimmed) return body;

  if (isHierarchicallyFormattedProvisionBody(trimmed)) {
    return focusArsonPunishmentInSectionBody(trimmed, query);
  }

  return trimProvisionBodyToQueryUpadafa(trimmed, query);
}

function splitNumberedUpadafaParts(body: string): string[] {
  return body.trim().split(/(?=^\s*\([\d०-९]+\)\s)/mu);
}

/**
 * When a merged दफा body contains many उपदफा, keep the opening operative
 * clauses plus a few query-matching segments (in statute order).
 */
export function trimProvisionBodyToQueryUpadafa(
  body: string,
  query: string
): string {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length < 350) return body;

  const parts = splitNumberedUpadafaParts(trimmed);
  const numberedParts = parts
    .map((text, index) => ({ text, index }))
    .filter(({ text }) => isNumberedUpadafaPart(text));
  if (numberedParts.length < 3) return body;

  const queryTerms = queryMatchTerms(query);
  if (queryTerms.length === 0) return body;

  const scored = parts.map((text, index) => ({
    text,
    index,
    score: isNumberedUpadafaPart(text)
      ? scoreTextAgainstQuery(text, queryTerms)
      : 0,
  }));

  const ranked = scored
    .filter((item) => isNumberedUpadafaPart(item.text))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (ranked.length === 0 || ranked[0].score < 8) return body;

  const maxTotal = ANCHOR_UPADAFA_COUNT + TOP_UPADAFA_COUNT;
  const scoreFloor = Math.max(4, Math.floor(ranked[0].score * 0.25));
  const pickedIndices = new Set<number>();

  for (let i = 0; i < Math.min(ANCHOR_UPADAFA_COUNT, numberedParts.length); i++) {
    pickedIndices.add(numberedParts[i].index);
  }

  for (const item of ranked) {
    if (pickedIndices.size >= maxTotal) break;
    if (item.score >= scoreFloor) pickedIndices.add(item.index);
  }

  pickedIndices.add(ranked[0].index);

  if (pickedIndices.size <= 1) return body;
  if (pickedIndices.size >= numberedParts.length) return body;

  const ordered = scored
    .filter((item) => pickedIndices.has(item.index))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text.trim())
    .filter(Boolean);

  if (ordered.length <= 1) return ordered[0] ?? body;

  return ordered.join("\n\n");
}

/** Drop duplicate "५०. title" line immediately after a स्रोत line in LLM output. */
export function dedupeAnswerSectionHeadings(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1]?.trim() ?? "";

    if (next && /^(\*\*)?स्रोत(\*\*)?\s*:/.test(line.trim())) {
      const dafaMatch = line.match(/दफा\s*[:\s]*([\d०-९]+(?:\.[\d०-९]+)?)/);
      if (dafaMatch) {
        const variants = sectionNumberVariants(dafaMatch[1]);
        const isDuplicateHeading = variants.some((num) => {
          const escaped = num.replace(/\./g, "\\.");
          return new RegExp(`^${escaped}\\.\\s*`).test(next);
        });
        if (isDuplicateHeading) {
          const bodyOnly = stripLeadingSectionHeading(next, dafaMatch[1]);
          result.push(line);
          if (bodyOnly.trim()) {
            result.push(bodyOnly);
          }
          i++;
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

/** Compact verbose स्रोत lines copied from full metadata blocks. */
export function normalizeAdvocateSourceLines(text: string): string {
  return text.replace(
    /^(\*\*)?स्रोत(\*\*)?\s*:\s*(?:पुस्तक\s*:\s*)?(.+?)\s*·\s*(?:दफा\s*:\s*)?([\d०-९]+(?:\.[\d०-९]+)?)(?:\s*[\u2014\u2013-]\s*[^\n]+)?/gm,
    (_match, open, close, book, dafa) => {
      const boldOpen = open ?? "";
      const boldClose = close ?? "";
      return `${boldOpen}स्रोत${boldClose}: ${book.trim()} · दफा ${toNepaliNumberDisplay(dafa)}`;
    }
  );
}
