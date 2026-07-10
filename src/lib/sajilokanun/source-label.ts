import { citationFromChunk, parseSectionTitleFromContent } from "./chunk-metadata";
import { resolveBookTitle } from "./legal-chunk";
import { toNepaliNumberDisplay } from "./nepali-digits";
import { extractChapterDisplayName } from "./provision-title-search";

/** Max source tags shown in the chat UI (advocate + quote). */
export const UI_SOURCES_DISPLAY_MAX = 3;

export type SourceLabelInput = {
  filename: string;
  section_label?: string | null;
  section_title?: string | null;
  chapter?: string | null;
  content?: string;
};

export type SourceLabelOptions = {
  /** Wrap chapter name in ** for markdown advocate answers. */
  boldChapter?: boolean;
};

function resolveChapterName(source: SourceLabelInput): string | null {
  if (source.chapter?.trim()) {
    const name = extractChapterDisplayName(source.chapter.trim());
    if (name && name.length <= 80) return name;
  }
  if (source.content?.trim()) {
    const citation = citationFromChunk(source.content, source.filename);
    if (citation.chapterName?.trim()) return citation.chapterName.trim();
  }
  return null;
}

function resolveSectionTitle(source: SourceLabelInput): string | null {
  if (source.section_title?.trim()) {
    return source.section_title.trim();
  }
  if (source.content?.trim()) {
    const title = parseSectionTitleFromContent(source.content);
    if (title?.trim()) return title.trim();
  }
  return null;
}

function formatDafaLabel(sectionLabel: string): string {
  const root = sectionLabel.split(".")[0]?.trim() || sectionLabel;
  return `दफा ${toNepaliNumberDisplay(root)}`;
}

export function formatSourceLabel(
  source: SourceLabelInput,
  options?: SourceLabelOptions
): string {
  const book = resolveBookTitle(source.filename);
  const dafa = source.section_label
    ? formatDafaLabel(source.section_label)
    : null;
  const chapterName = resolveChapterName(source);
  const chapterPart = chapterName
    ? options?.boldChapter
      ? `**${chapterName}**`
      : chapterName
    : null;
  const sectionTitle = resolveSectionTitle(source);
  const titlePart =
    sectionTitle && sectionTitle !== chapterName ? sectionTitle : null;

  return [book, chapterPart, titlePart, dafa].filter(Boolean).join(" · ");
}

/** One tag per unique book + दफा label (keeps highest-similarity chunk). */
export function dedupeSourcesForDisplay<
  T extends SourceLabelInput & { id: string; similarity: number },
>(sources: T[]): T[] {
  const byLabel = new Map<string, T>();
  for (const source of sources) {
    const key = formatSourceLabel(source);
    const existing = byLabel.get(key);
    if (!existing || source.similarity > existing.similarity) {
      byLabel.set(key, source);
    }
  }
  return [...byLabel.values()];
}
