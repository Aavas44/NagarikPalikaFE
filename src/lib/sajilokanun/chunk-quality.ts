import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";

/** Court form templates and appendix junk falsely tagged as दफा sections */
const FORM_JUNK_RE =
  /\.{4,}|पाउने\s+पाउने|जवाफ\s*\.{3,}|तपाईँ?\s*को\s*उमेर|[a-zA-Z\[\]{}'"\\/]{5,}/;

const METADATA_LINE =
  /^(?:पुस्तक|भाग|परिच्छेद|दफा|उपदफा|खण्ड|प्रकार|पृष्ठ)\s*:/;

function stripPageMarkers(text: string): string {
  return text.replace(/\[PAGE:\d+\]/g, " ");
}

function structuredHeaderBlock(content: string): string {
  const blank = content.indexOf("\n\n");
  return blank >= 0 ? content.slice(0, blank) : content.split("\n")[0] ?? content;
}

function structuredProvisionBody(content: string): string {
  const blank = content.indexOf("\n\n");
  if (blank >= 0) return content.slice(blank + 2).trim();
  return content
    .split("\n")
    .filter((line, index) => index === 0 || !METADATA_LINE.test(line.trim()))
    .slice(1)
    .join("\n")
    .trim();
}

function bodyForQualityChecks(content: string): string {
  const body = structuredProvisionBody(content);
  return body
    .split("\n")
    .filter((line) => !METADATA_LINE.test(line.trim()))
    .join("\n");
}

export function isFormOrJunkSection(body: string): boolean {
  const clean = stripPageMarkers(bodyForQualityChecks(body));
  return (
    FORM_JUNK_RE.test(clean) ||
    /फिराद.*\.{3,}/.test(clean) ||
    /बमोिजम\s*यो\s*मुद्दा/.test(clean) ||
    /फिराददाबी\s*पूर्ण|फैसलाको\s*संक्षिप्त\s*विवरण|सरकारी\s*जग्गा\s*दपोट|गर्दछु\s*\/\s*गर्द/.test(
      clean
    )
  );
}

export function hasSectionHeader(
  content: string,
  sectionNum: string
): boolean {
  const header = structuredHeaderBlock(content);
  const nepali = toNepaliNumberDisplay(sectionNum);
  return (
    new RegExp(`दफा\\s*:?\\s*${nepali}\\s*—`).test(header) ||
    new RegExp(`दफा\\s*:?\\s*${sectionNum}\\s*—`).test(header) ||
    new RegExp(`दफा\\s+${nepali}\\s*—`).test(header) ||
    new RegExp(`दफा\\s+${sectionNum}\\s*—`).test(header)
  );
}

/** Higher = better provision chunk for RAG */
export function sectionChunkQuality(
  content: string,
  sectionNum?: string,
  pageNumber?: number | null,
  sectionLabel?: string | null
): number {
  let score = 0;
  const header = structuredHeaderBlock(content);
  const body = bodyForQualityChecks(content);
  const label = sectionLabel ?? parseSectionLabelFromContent(content);

  if (/दफा\s*[:：]?\s*[\d०-९]+(?:\.[\d०-९]+)?\s*—/.test(header)) score += 4;
  if (sectionNum && hasSectionHeader(content, sectionNum)) score += 2;
  if (sectionNum && label === sectionNum) score += 5;
  if (sectionNum && label?.startsWith(`${sectionNum}.`)) score -= 1;
  if (/परिच्छेद/.test(header)) score += 1;
  if (/[“"][\u0900-\u097F]+[”"]\s*भन्नाले/.test(body)) score += 2;
  if (/\([ङचछजझञटठडढणतथ]\)/.test(body)) score += 3;
  if (/म्झनु|छर्न|धार्र|नामनि\s*धार/.test(body)) score -= 4;
  if (isFormOrJunkSection(body)) score -= 10;

  const bodyWithoutMeta = stripPageMarkers(body)
    .split("\n")
    .filter((line) => !/^प्रकार\s*:/.test(line.trim()))
    .join("\n");
  if (/[a-zA-Z\[\]{}]{3,}/.test(bodyWithoutMeta)) score -= 5;

  if (sectionNum && pageNumber != null) {
    const sec = parseInt(sectionNum, 10);
    if (!Number.isNaN(sec) && sec <= 30) {
      if (pageNumber <= 5) score += 3;
      if (pageNumber > 50) score -= 8;
    }
  }

  return score;
}

function parseSectionLabelFromContent(content: string): string | null {
  const header = structuredHeaderBlock(content);
  const match = header.match(/दफा\s*[:：]?\s*([\d०-९]+(?:\.[\d०-९]+)?)\s*—/);
  return match ? toArabicDigits(match[1]) : null;
}

export function rankSectionChunks<
  T extends {
    content: string;
    page_number?: number | null;
    section_label?: string | null;
  }
>(
  chunks: T[],
  sectionNum: string
): (T & { quality: number })[] {
  return chunks
    .map((c) => ({
      ...c,
      quality: sectionChunkQuality(
        c.content,
        sectionNum,
        c.page_number,
        c.section_label
      ),
    }))
    .filter((c) => c.quality > -3)
    .sort((a, b) => b.quality - a.quality);
}
