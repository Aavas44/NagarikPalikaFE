import type { PdfPage } from "./pdf-extract";
import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";
import { isFormOrJunkSection } from "./chunk-quality";
import { resolveBookTitleFromFilename } from "./lawbooks";

const MAX_SECTION_CHARS = 1200;
const SUBCHUNK_OVERLAP = 150;
const PAGE_MARKER = /\[PAGE:(\d+)\]/g;

export type LegalChunk = {
  content: string;
  pageNumber: number;
  sectionLabel: string | null;
  chapter: string | null;
  sectionTitle: string | null;
};

const SECTION_START_RE = /(?:^|[\s।])([\d०-९]{1,4})\.\s+/g;
const CHAPTER_RE =
  /[पफ]रिच्छेद\s*[–\-]?\s*([\d०-९]+)\s+(.+?)(?=\s[\d०-९]{1,4}\.\s|[।]|$)/g;
const SECTION_HEADER_RE = /^([\d०-९]{1,4})\.\s+/;
const SUBSECTION_START_RE =
  /(?:^|[\s।])((?:उपदफा\s*)?\([\d०-९]{1,2}\))\s*/g;

function extractSectionTitle(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const colonIdx = trimmed.indexOf("ः");
  const end = colonIdx > 0 ? Math.min(colonIdx + 1, 80) : 80;
  return trimmed.slice(0, end).replace(/\s+/g, " ").trim();
}

function pageAtOffset(text: string, offset: number): number {
  let page = 1;
  PAGE_MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGE_MARKER.exec(text)) !== null) {
    if (match.index > offset) break;
    page = Number(match[1]);
  }
  return page;
}

function stripPageMarkers(text: string): string {
  return text.replace(PAGE_MARKER, " ").replace(/\s+/g, " ").trim();
}

function buildChunk(
  sectionLabel: string,
  body: string,
  pageNumber: number,
  chapter: string | null,
  actTitle: string,
  subsectionLabel?: string | null
): LegalChunk {
  const cleanBody = stripPageMarkers(body);
  const sectionTitle = extractSectionTitle(cleanBody);
  const subsectionPart = subsectionLabel ? `उपदफा ${subsectionLabel}` : null;
  const sectionNumArabic = sectionLabel.split(".")[0];
  const sectionNumDisplay = toNepaliNumberDisplay(sectionNumArabic);
  const sectionLabelDisplay = sectionLabel.includes(".")
    ? sectionLabel
        .split(".")
        .map((part) => toNepaliNumberDisplay(part))
        .join(".")
    : sectionNumDisplay;
  const sectionPart = sectionTitle
    ? `दफा ${sectionNumDisplay} — ${sectionTitle}`
    : `दफा ${toNepaliNumberDisplay(sectionLabel)}`;
  const header = [
    actTitle,
    chapter,
    sectionPart,
    subsectionPart,
    `p.${toNepaliNumberDisplay(String(pageNumber))}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const displayLabel = subsectionLabel
    ? `${sectionNumDisplay}. ${subsectionLabel} ${cleanBody}`
    : `${sectionLabelDisplay}. ${cleanBody}`;

  return {
    content: `${header}\n${displayLabel.trim()}`,
    pageNumber,
    sectionLabel,
    chapter,
    sectionTitle,
  };
}

function splitByCharLimit(
  sectionLabel: string,
  body: string,
  pageNumber: number,
  chapter: string | null,
  actTitle: string
): LegalChunk[] {
  const parts: string[] = [];
  const sentences = stripPageMarkers(body).split(/(?<=।)\s+/);
  let current = "";

  for (const sentence of sentences) {
    const next = (current + " " + sentence).trim();
    if (next.length > MAX_SECTION_CHARS && current) {
      parts.push(current.trim());
      current = current.slice(-SUBCHUNK_OVERLAP) + " " + sentence;
    } else {
      current = next;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map((part, index) => {
    const label =
      parts.length > 1 ? `${sectionLabel}.8.${index + 1}` : sectionLabel;
    return buildChunk(label, part, pageNumber, chapter, actTitle);
  });
}

function splitBySubsections(
  sectionLabel: string,
  body: string,
  pageNumber: number,
  chapter: string | null,
  actTitle: string,
  fullText: string,
  absoluteStart: number
): LegalChunk[] {
  const markers: { label: string; start: number }[] = [];
  const re = new RegExp(SUBSECTION_START_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    const label = match[1];
    const start = match.index + match[0].indexOf(label);
    markers.push({ label, start });
  }

  if (markers.length === 0) {
    const clean = stripPageMarkers(body);
    if (clean.length <= MAX_SECTION_CHARS) {
      return [buildChunk(sectionLabel, body, pageNumber, chapter, actTitle)];
    }
    return splitByCharLimit(sectionLabel, body, pageNumber, chapter, actTitle);
  }

  const chunks: LegalChunk[] = [];
  const preamble = body.slice(0, markers[0].start).trim();
  if (preamble.length > 30) {
    const preambleClean = stripPageMarkers(preamble);
    if (preambleClean.length <= MAX_SECTION_CHARS) {
      chunks.push(
        buildChunk(sectionLabel, preamble, pageNumber, chapter, actTitle)
      );
    } else {
      chunks.push(
        ...splitByCharLimit(sectionLabel, preamble, pageNumber, chapter, actTitle)
      );
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const { label, start } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].start : body.length;
    const subBody = body.slice(start, end).replace(/^(?:उपदफा\s*)?\([^)]+\)\s*/, "").trim();
    if (!subBody) continue;

    const subIndex = toArabicDigits(label.replace(/[^\d०-९]/g, "") || String(i + 1));
    const subLabel = `${sectionLabel}.${subIndex}`;
    const subPage = pageAtOffset(fullText, absoluteStart + start);

    if (stripPageMarkers(subBody).length <= MAX_SECTION_CHARS) {
      chunks.push(
        buildChunk(subLabel, subBody, subPage, chapter, actTitle, label)
      );
    } else {
      chunks.push(
        ...splitByCharLimit(subLabel, subBody, subPage, chapter, actTitle)
      );
    }
  }

  return chunks;
}

function splitSectionBody(
  sectionLabel: string,
  body: string,
  pageNumber: number,
  chapter: string | null,
  actTitle: string,
  fullText: string,
  absoluteStart: number
): LegalChunk[] {
  const clean = stripPageMarkers(body);
  if (clean.length <= MAX_SECTION_CHARS) {
    return [buildChunk(sectionLabel, body, pageNumber, chapter, actTitle)];
  }
  return splitBySubsections(
    sectionLabel,
    body,
    pageNumber,
    chapter,
    actTitle,
    fullText,
    absoluteStart
  );
}

function normalizeSectionBoundaries(text: string): string {
  let result = text.replace(/प\s*र\s*ि?\s*च\s*्छेद/g, "परिच्छेद");
  result = result.replace(/फ\s*र\s*ि?\s*च\s*्छेद/g, "फरिच्छेद");
  result = result.replace(/परर(?:ा)?िष(?:ा)?(?:ाः)?/g, "परिभाषा");
  result = result.replace(/[mज्ञ]\s*।\s*नयख\s*।\s*ल[^\s]{0,6}\s*/g, " ");
  result = result.replace(/द्द([\d०-९]{1,3})[।]/g, (_, n) => `\n${n}. `);
  result = result.replace(/द्ध([\d०-९]{1,3})\s*[।]?/g, (_, n) => `\n${n}. `);

  result = result.replace(
    /([\u0900-\u097F])([\d०-९]{1,4})\.\s+(?=[\u0900-\u097F])/g,
    (match, before: string, sectionNum: string) =>
      /[\d०-९]/.test(before) ? match : `${before}\n${sectionNum}. `
  );

  result = result.replace(
    /(?:^|[\s\u0964])([\d०-९]{1,3})[।](?=\s*[\u0900-\u097F])/gm,
    (match, sectionNum: string) => {
      const n = Number(toArabicDigits(sectionNum));
      if (n <= 0 || n > 399) return match;
      return `\n${sectionNum}. `;
    }
  );

  return result;
}

function concatenatePages(pages: PdfPage[]): string {
  return pages
    .map((page) => `[PAGE:${page.pageNumber}] ${page.text}`)
    .join("\n");
}

function extractChapters(fullText: string): Map<number, string> {
  const chapters = new Map<number, string>();
  for (const m of fullText.matchAll(CHAPTER_RE)) {
    if (m.index != null) {
      const name = m[2].trim().replace(/\s+/g, " ");
      chapters.set(
        m.index,
        `परिच्छेद ${toNepaliNumberDisplay(toArabicDigits(m[1]))} — ${name}`
      );
    }
  }
  return chapters;
}

function chapterAtOffset(chapters: Map<number, string>, offset: number): string | null {
  let current: string | null = null;
  for (const [index, chapter] of chapters) {
    if (index <= offset) current = chapter;
    else break;
  }
  return current;
}

function isPreambleNoiseSection(label: string, body: string): boolean {
  const arabic = toArabicDigits(label);
  if (/^0\d+$/.test(arabic)) return true;
  if (arabic === "6" && /शोिन|संशोधन/.test(body)) return true;
  if (/^0\d+\./.test(label)) return true;
  return false;
}

function splitDocumentSections(
  fullText: string,
  actTitle: string
): LegalChunk[] {
  const chapters = extractChapters(fullText);
  const chunks: LegalChunk[] = [];
  const markers: { label: string; start: number }[] = [];

  const re = new RegExp(SECTION_START_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(fullText)) !== null) {
    const label = match[1];
    const start = match.index + match[0].indexOf(label);
    markers.push({ label, start });
  }

  if (markers.length === 0) {
    const trimmed = stripPageMarkers(fullText);
    if (trimmed.length > 50) {
      chunks.push({
        content: `${actTitle} | p.1\n${trimmed}`,
        pageNumber: 1,
        sectionLabel: null,
        chapter: null,
        sectionTitle: null,
      });
    }
    return chunks;
  }

  for (let i = 0; i < markers.length; i++) {
    const { label, start } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].start : fullText.length;
    const raw = fullText.slice(start, end);
    const body = raw.replace(SECTION_HEADER_RE, "").trim();
    if (!body || isFormOrJunkSection(body)) continue;

    const sectionLabel = toArabicDigits(label);
    if (isPreambleNoiseSection(sectionLabel, body)) continue;
    const pageNumber = pageAtOffset(fullText, start);
    const chapter = chapterAtOffset(chapters, start);

    chunks.push(
      ...splitSectionBody(
        sectionLabel,
        body,
        pageNumber,
        chapter,
        actTitle,
        fullText,
        start
      )
    );
  }

  return chunks;
}

export function splitLegalSections(
  pages: PdfPage[],
  actTitle: string
): LegalChunk[] {
  const fullText = normalizeSectionBoundaries(concatenatePages(pages));
  return splitDocumentSections(fullText, actTitle);
}

/** Map PDF paths / legacy header names to display titles. */
export function resolveBookTitle(source: string): string {
  return resolveBookTitleFromFilename(source.replace(/\\/g, "/").trim());
}

export function titleFromFilename(filename: string): string {
  return resolveBookTitle(filename);
}
