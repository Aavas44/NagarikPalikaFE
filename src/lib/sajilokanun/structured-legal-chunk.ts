import type { PdfPage } from "./pdf-extract";
import type {
  IndexingRule,
  StructuredChunkMetadata,
  StructuredIngestChunk,
} from "./indexing-rules";
import { normalizeForEmbedding } from "./embedding-text";
import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";
import { cleanNepaliText } from "./text-clean";
import { isFormOrJunkSection } from "./chunk-quality";

const PAGE_MARKER = /\[PAGE:(\d+)\]/g;
const SECTION_START_RE = /(?:^|[\s।])([\d०-९]{1,4})\.\s+/g;
const SECTION_HEADER_RE = /^([\d०-९]{1,4})\.\s+/;
const CHAPTER_RE =
  /परिच्छेद\s*[–\-]\s*([\d०-९]+)\s+([^\d]+?)(?=[\d०-९]{1,4}\.)/g;
const PART_RE = /भाग\s*[–\-]?\s*([\d०-९]+)/g;
const SUBSECTION_RE =
  /(?:^|[\s।])\(\s*([\d०-९]{1,2})\s*\)\s*/g;
const CLAUSE_RE = /(?:^|[\s।–\-])\(\s*([क-ह])\s*\)\s*/g;

const HEADER_FOOTER_PATTERNS = [
  /मुलुकी\s*देवानी\s*[\(（]?\s*संहिता\s*[\)）]?\s*[,]?\s*२०७४/gi,
  /^\s*[\d०-९]{1,4}\s*$/gm,
  /^\s*[-–—]{2,}\s*$/gm,
];

const CLAUSE_ROMAN: Record<string, string> = {
  क: "ka",
  ख: "kha",
  ग: "ga",
  घ: "gha",
  च: "cha",
  छ: "chha",
  ज: "ja",
  झ: "jha",
};

function stripPageNoise(text: string): string {
  let result = text;
  for (const pattern of HEADER_FOOTER_PATTERNS) {
    result = result.replace(pattern, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

function normalizeDocumentText(text: string): string {
  let result = text
    .replace(/प\s*र\s*ि?\s*च\s*्छेद/g, "परिच्छेद")
    .replace(/फ\s*र\s*ि?\s*च\s*्छेद/g, "फरिच्छेद")
    .replace(/परिरच्छेद/g, "परिच्छेद")
    .replace(/भाग([\d०-९])/g, "भाग $1")
    .replace(/द्द([\d०-९]{1,3})[।]/g, (_, n) => `\n${n}. `)
    .replace(/द्ध([\d०-९]{1,3})\s*[।]?/g, (_, n) => `\n${n}. `);

  result = result.replace(
    /([\u0900-\u097F])([\d०-९]{1,4})\.\s+(?=[\u0900-\u097F])/g,
    (match, before: string, sectionNum: string) =>
      /[\d०-९]/.test(before) ? match : `${before}\n${sectionNum}. `
  );

  return cleanNepaliText(result);
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

function extractSectionTitle(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const colonIdx = trimmed.indexOf("ः");
  const end = colonIdx > 0 ? Math.min(colonIdx + 1, 100) : 100;
  return trimmed
    .slice(0, end)
    .replace(/^\([\d०-९]+\)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildChunkId(
  sectionDafa: string,
  subsection?: string | null,
  clause?: string | null
): string {
  const sec = toArabicDigits(sectionDafa).replace(/\./g, "_");
  let id = `sec_${sec}`;
  if (subsection) {
    const subNum = toArabicDigits(subsection.replace(/[^\d०-९]/g, ""));
    if (subNum) id += `_sub_${subNum}`;
  }
  if (clause) {
    const letter = clause.replace(/[()]/g, "").trim();
    id += `_${CLAUSE_ROMAN[letter] ?? letter}`;
  }
  return id;
}

function formatPart(partNum: string): string {
  return `भाग ${toNepaliNumberDisplay(toArabicDigits(partNum))}`;
}

function extractOffsetMap(
  text: string,
  pattern: RegExp,
  formatter: (num: string, full: RegExpMatchArray) => string
): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of text.matchAll(pattern)) {
    if (m.index != null && m[1]) {
      map.set(m.index, formatter(m[1], m));
    }
  }
  return map;
}

function valueAtOffset(map: Map<number, string>, offset: number): string | null {
  let current: string | null = null;
  for (const [index, value] of map) {
    if (index <= offset) current = value;
    else break;
  }
  return current;
}

function buildMetadata(
  rule: IndexingRule,
  sectionDafa: string,
  sectionTitle: string | null,
  part: string | null,
  chapter: string | null,
  subsection: string | null,
  clause: string | null
): StructuredChunkMetadata {
  return {
    chunk_id: buildChunkId(sectionDafa, subsection, clause),
    document_title: rule.documentTitle,
    document_category: rule.documentCategory,
    part,
    chapter,
    section_dafa: toNepaliNumberDisplay(
      toArabicDigits(sectionDafa.split(".")[0])
    ),
    section_title: sectionTitle,
    subsection_upadafa: subsection,
    clause_khanda: clause,
  };
}

function buildEmbedText(metadata: StructuredChunkMetadata, body: string): string {
  const prefix = [
    metadata.document_title,
    metadata.part,
    metadata.chapter,
    `दफा ${metadata.section_dafa}`,
    metadata.section_title,
    metadata.subsection_upadafa
      ? `उपदफा ${metadata.subsection_upadafa}`
      : null,
    metadata.clause_khanda ? `खण्ड ${metadata.clause_khanda}` : null,
  ]
    .filter(Boolean)
    .join(" - ");

  return `[${prefix}]: ${normalizeForEmbedding(body)}`;
}

function buildContent(
  metadata: StructuredChunkMetadata,
  body: string,
  pageNumber: number
): string {
  const lines = [
    `पुस्तक : ${metadata.document_title}`,
    metadata.part && `भाग : ${metadata.part.replace(/^भाग\s*/, "")}`,
    metadata.chapter &&
      `परिच्छेद : ${metadata.chapter.replace(/^परिच्छेद\s*/, "")}`,
    metadata.section_title
      ? `दफा : ${metadata.section_dafa} — ${metadata.section_title}`
      : `दफा : ${metadata.section_dafa}`,
    metadata.subsection_upadafa &&
      `उपदफा : ${metadata.subsection_upadafa}`,
    metadata.clause_khanda && `खण्ड : ${metadata.clause_khanda}`,
    `पृष्ठ : ${toNepaliNumberDisplay(String(pageNumber))}`,
  ].filter(Boolean);

  const sectionNum = metadata.section_dafa;
  const displayBody = body.trim().startsWith(sectionNum)
    ? body.trim()
    : `${sectionNum}. ${body.trim()}`;

  return `${lines.join("\n")}\n\n${displayBody}`;
}

function makeChunk(
  rule: IndexingRule,
  sectionDafa: string,
  body: string,
  pageNumber: number,
  part: string | null,
  chapter: string | null,
  subsection: string | null,
  clause: string | null
): StructuredIngestChunk | null {
  const cleanBody = stripPageMarkers(body);
  if (!cleanBody || cleanBody.length < 15 || isFormOrJunkSection(cleanBody)) {
    return null;
  }

  const sectionTitle = extractSectionTitle(cleanBody);
  const metadata = buildMetadata(
    rule,
    sectionDafa,
    sectionTitle,
    part,
    chapter,
    subsection,
    clause
  );

  return {
    chunkId: metadata.chunk_id,
    text: cleanBody,
    content: buildContent(metadata, cleanBody, pageNumber),
    embedText: buildEmbedText(metadata, cleanBody),
    metadata,
    pageNumber,
    sectionLabel: toArabicDigits(sectionDafa),
    chapter,
    sectionTitle,
    subsectionLabel: metadata.subsection_upadafa,
    clauseLabel: clause,
    part,
  };
}

function stripMarkerFromSlice(slice: string, markerText: string): string {
  const idx = slice.indexOf(markerText);
  if (idx === -1) return slice.trim();
  return slice.slice(idx + markerText.length).trim();
}

function splitByMarkers(
  body: string,
  pattern: RegExp,
  formatLabel: (group: string) => string
): { label: string | null; text: string }[] {
  const markers: { label: string; start: number; markerText: string }[] = [];
  const re = new RegExp(pattern.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const label = formatLabel(match[1]);
    markers.push({
      label,
      start: match.index,
      markerText: match[0],
    });
  }

  if (markers.length === 0) {
    return [{ label: null, text: body }];
  }

  const parts: { label: string | null; text: string }[] = [];
  const preamble = body.slice(0, markers[0].start).trim();
  if (preamble.length > 20) {
    parts.push({ label: null, text: preamble });
  }

  for (let i = 0; i < markers.length; i++) {
    const { label, start, markerText } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].start : body.length;
    const slice = body.slice(start, end);
    const text = stripMarkerFromSlice(slice, markerText);
    if (text) parts.push({ label, text });
  }

  return parts;
}

function splitSection(
  rule: IndexingRule,
  sectionDafa: string,
  body: string,
  pageNumber: number,
  part: string | null,
  chapter: string | null,
  fullText: string,
  absoluteStart: number
): StructuredIngestChunk[] {
  const maxChars = rule.chunking.maxSectionChars;
  const clean = stripPageMarkers(body);

  if (clean.length <= maxChars) {
    const chunk = makeChunk(
      rule,
      sectionDafa,
      body,
      pageNumber,
      part,
      chapter,
      null,
      null
    );
    return chunk ? [chunk] : [];
  }

  if (!rule.chunking.splitBySubsection) {
    const chunk = makeChunk(
      rule,
      sectionDafa,
      body,
      pageNumber,
      part,
      chapter,
      null,
      null
    );
    return chunk ? [chunk] : [];
  }

  const subsections = splitByMarkers(
    body,
    SUBSECTION_RE,
    (n) => `(${toNepaliNumberDisplay(toArabicDigits(n))})`
  );
  const chunks: StructuredIngestChunk[] = [];

  for (const sub of subsections) {
    const subPage = pageAtOffset(fullText, absoluteStart);
    const subClean = stripPageMarkers(sub.text);

    if (
      subClean.length <= maxChars ||
      !rule.chunking.splitByClause ||
      !sub.label
    ) {
      const chunk = makeChunk(
        rule,
        sectionDafa,
        sub.text,
        subPage,
        part,
        chapter,
        sub.label,
        null
      );
      if (chunk) chunks.push(chunk);
      continue;
    }

    const clauses = splitByMarkers(
      sub.text,
      CLAUSE_RE,
      (letter) => `(${letter})`
    );
    for (const clause of clauses) {
      const chunk = makeChunk(
        rule,
        sectionDafa,
        clause.text,
        subPage,
        part,
        chapter,
        sub.label,
        clause.label
      );
      if (chunk) chunks.push(chunk);
    }
  }

  return chunks;
}

function concatenatePages(pages: PdfPage[]): string {
  return pages
    .map((page) => `[PAGE:${page.pageNumber}] ${page.text}`)
    .join("\n");
}

export function buildStructuredChunks(
  pages: PdfPage[],
  rule: IndexingRule
): StructuredIngestChunk[] {
  let fullText = concatenatePages(pages);
  if (rule.chunking.stripPageNoise) {
    fullText = stripPageNoise(fullText);
  }
  fullText = normalizeDocumentText(fullText);

  const parts = extractOffsetMap(fullText, PART_RE, (num) => formatPart(num));
  const chapters = extractOffsetMap(fullText, CHAPTER_RE, (num, m) => {
    const name = m[2]?.trim().replace(/\s+/g, " ") ?? "";
    return `परिच्छेद ${toNepaliNumberDisplay(toArabicDigits(num))}${name ? ` — ${name}` : ""}`;
  });

  const chunks: StructuredIngestChunk[] = [];
  const markers: { label: string; start: number }[] = [];
  const re = new RegExp(SECTION_START_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(fullText)) !== null) {
    const label = match[1];
    const start = match.index + match[0].indexOf(label);
    markers.push({ label, start });
  }

  for (let i = 0; i < markers.length; i++) {
    const { label, start } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].start : fullText.length;
    const raw = fullText.slice(start, end);
    const body = raw.replace(SECTION_HEADER_RE, "").trim();
    if (!body) continue;

    const sectionLabel = toArabicDigits(label);
    const pageNumber = pageAtOffset(fullText, start);
    const part = valueAtOffset(parts, start);
    const chapter = valueAtOffset(chapters, start);

    chunks.push(
      ...splitSection(
        rule,
        sectionLabel,
        body,
        pageNumber,
        part,
        chapter,
        fullText,
        start
      )
    );
  }

  return chunks;
}

export function assessExtractionQuality(pages: PdfPage[]): number {
  const sample = pages
    .slice(0, 30)
    .map((p) => p.text)
    .join(" ");
  if (sample.length < 200) return 0;

  let score = 1;
  if (!/परिच्छेद|परिरच्छेद|भाग/.test(sample)) score -= 0.35;
  if (!/[\d०-९]{1,3}\./.test(sample)) score -= 0.25;

  const brokenWordSpaces = (
    sample.match(/[\u0900-\u097F]\s+[\u0900-\u097F]/g) ?? []
  ).length;
  if (brokenWordSpaces > sample.length / 40) score -= 0.4;

  return Math.max(0, Math.min(1, score));
}
