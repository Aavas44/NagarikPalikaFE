export type LegalCitation = {
  bookName: string | null;
  chapterNumber: string | null;
  chapterName: string | null;
  sectionNumber: string | null;
  sectionTitle: string | null;
  subsection: string | null;
  clauseKhanda: string | null;
  pageNumber: number | null;
};

import {
  toArabicDigits,
  toNepaliNumberDisplay,
} from "./nepali-digits";
import { resolveBookTitle } from "./legal-chunk";

/** Strip trailing visarga/colon from section titles in metadata. */
export function cleanSectionTitleForMeta(title: string): string {
  return title.replace(/[ः:]+$/u, "").trim();
}

export function parseLegalCitation(
  content: string,
  filename?: string
): LegalCitation {
  const headerEnd = content.indexOf("\n\n");
  const headerBlock =
    headerEnd >= 0 ? content.slice(0, headerEnd) : content.split("\n")[0] ?? content;
  const headerLine = headerBlock.split("\n")[0] ?? content;

  const lineValue = (label: string): string | null => {
    const match = headerBlock.match(
      new RegExp(`^${label}\\s*:\\s*(.+)$`, "m")
    );
    return match?.[1]?.trim() || null;
  };

  const bookFromHeader =
    lineValue("पुस्तक") ?? (headerLine.split("|")[0]?.trim() || null);
  const bookName = bookFromHeader
    ? resolveBookTitle(bookFromHeader)
    : filename
      ? resolveBookTitle(filename)
      : null;

  const chapterRaw = lineValue("परिच्छेद");
  const chapterFull = chapterRaw
    ? chapterRaw.match(/^([\d०-९]+)(?:\s*[—–-]\s*(.+))?$/)
    : headerLine.match(
        /[पफ]रिच्छेद\s*([\d०-९]+)(?:\s*[—–-]\s*(.+?))?(?:\s*\||$)/
      );
  const chapterNumber = chapterFull ? toArabicDigits(chapterFull[1]) : null;
  const chapterName = chapterFull?.[2]?.trim() || null;

  const dafaRaw = lineValue("दफा");
  const sectionMatch = dafaRaw
    ? dafaRaw.match(/^([\d०-९]+(?:\.[\d०-९]+)?)(?:\s*[—–-]\s*(.+))?$/)
    : headerLine.match(
        /दफा\s+([\d०-९]+(?:\.[\d०-९]+)?)(?:\s*[—–-]\s*(.+?))?(?:\s*\||$)/
      );
  const sectionNumber = sectionMatch
    ? toArabicDigits(sectionMatch[1])
    : null;
  const sectionTitleFromHeader = sectionMatch?.[2]?.trim() || null;

  const upadafaRaw = lineValue("उपदफा");
  const subsectionMatch = upadafaRaw
    ? { 1: `(${upadafaRaw})` }
    : headerLine.match(/उपदफा\s+(\([^)]+\))/);
  const subsection = subsectionMatch?.[1] ?? null;

  const khandaRaw = lineValue("खण्ड");
  const khanda = khandaRaw ? `(${khandaRaw})` : null;

  const pageRaw = lineValue("पृष्ठ");
  const pageMatch = pageRaw
    ? { 1: pageRaw }
    : headerLine.match(/p\.([\d०-९]+)/);
  const pageNumber = pageMatch
    ? Number(toArabicDigits(pageMatch[1]))
    : null;

  let sectionTitle = sectionTitleFromHeader;
  if (!sectionTitle && content.includes("\n")) {
    const body = content.split("\n\n").slice(1).join("\n\n").trim() || content.split("\n").slice(1).join("\n").trim();
    const colonIdx = body.indexOf("ः");
    if (colonIdx > 0) {
      sectionTitle = body
        .slice(0, Math.min(colonIdx + 1, 100))
        .replace(/^[\d०-९]+(?:\.[\d०-९]+)?\.\s*/, "")
        .replace(/\s*\([^)]+\)\s*/, "")
        .trim();
    }
  }

  return {
    bookName,
    chapterNumber,
    chapterName,
    sectionNumber,
    sectionTitle: sectionTitle || null,
    subsection,
    clauseKhanda: khanda,
    pageNumber,
  };
}

export function formatCitationBlock(citation: LegalCitation): string {
  const chapterNum = citation.chapterNumber
    ? toNepaliNumberDisplay(citation.chapterNumber)
    : null;
  const sectionNum = citation.sectionNumber
    ? toNepaliNumberDisplay(citation.sectionNumber)
    : null;

  const lines = [
    citation.bookName && `पुस्तक : ${citation.bookName}`,
    chapterNum && `परिच्छेद नं : ${chapterNum}`,
    citation.chapterName && `परिच्छेद नाम : ${citation.chapterName}`,
    sectionNum &&
      `दफा : ${sectionNum}${citation.sectionTitle ? ` — ${cleanSectionTitleForMeta(citation.sectionTitle)}` : ""}`,
    citation.subsection && `उपदफा : ${citation.subsection}`,
    citation.clauseKhanda && `खण्ड : ${citation.clauseKhanda}`,
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatCitationInline(citation: LegalCitation): string {
  return formatCitationBlock(citation).replace(/\n/g, " · ");
}
