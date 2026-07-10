import {
  formatCitationBlock,
  parseLegalCitation,
  type LegalCitation,
} from "./legal-citation";
import { toNepaliNumberDisplay } from "./nepali-digits";

export type { LegalCitation };
export { parseLegalCitation, formatCitationBlock };

export function parseSectionLabelFromContent(content: string): string | null {
  return parseLegalCitation(content).sectionNumber;
}

export function parsePageFromContent(content: string): number | null {
  return parseLegalCitation(content).pageNumber;
}

export function parseChapterFromContent(content: string): string | null {
  const c = parseLegalCitation(content);
  if (!c.chapterNumber) return null;
  const num = toNepaliNumberDisplay(c.chapterNumber);
  return c.chapterName
    ? `परिच्छेद ${num} — ${c.chapterName}`
    : `परिच्छेद ${num}`;
}

export function parseSectionTitleFromContent(content: string): string | null {
  return parseLegalCitation(content).sectionTitle;
}

export function parseSubsectionFromContent(content: string): string | null {
  return parseLegalCitation(content).subsection;
}

export function parseBookNameFromContent(
  content: string,
  filename?: string
): string | null {
  return parseLegalCitation(content, filename).bookName;
}

export function citationFromChunk(
  content: string,
  filename?: string
): LegalCitation {
  return parseLegalCitation(content, filename);
}
