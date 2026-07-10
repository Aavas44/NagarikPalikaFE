import { lookupDafaPage } from "./dafa-page-map";
import { formatSourceLabel } from "./source-label";
import { parsePageFromContent } from "./chunk-metadata";
import { resolveBookIdFromFilename } from "./lawbooks";

export type SourcePdfInput = {
  filename: string;
  page_number?: number | null;
  content?: string;
  section_label?: string | null;
  section_title?: string | null;
  chapter?: string | null;
};

export type SourcePdfPreview = {
  src: string;
  title: string;
  page: number | null;
};

export function resolveSourcePage(source: SourcePdfInput): number | null {
  if (source.page_number != null && source.page_number > 0) {
    return source.page_number;
  }
  const bookId = resolveBookIdFromFilename(source.filename);
  if (bookId && source.section_label?.trim()) {
    const mapped = lookupDafaPage(bookId, source.section_label);
    if (mapped != null) return mapped;
  }
  if (source.content) {
    const parsed = parsePageFromContent(source.content);
    if (parsed != null && parsed > 0) return parsed;
  }
  return null;
}

export function buildLawPdfUrl(bookId: string, page?: number | null): string {
  const base = `/api/sajilokanun/law-pdf?book=${encodeURIComponent(bookId)}`;
  if (page != null && page > 0) {
    return `${base}&page=${page}`;
  }
  return base;
}

export function sourcePdfHref(source: SourcePdfInput): string | null {
  return sourcePdfPreview(source)?.src ?? null;
}

export function sourcePdfPreview(
  source: SourcePdfInput
): SourcePdfPreview | null {
  const bookId = resolveBookIdFromFilename(source.filename);
  if (!bookId) return null;
  const page = resolveSourcePage(source);
  return {
    src: buildLawPdfUrl(bookId, page),
    page,
    title: formatSourceLabel(source),
  };
}

export function sourcePdfLinkTitle(source: SourcePdfInput): string {
  const page = resolveSourcePage(source);
  return page
    ? `मूल PDF मा पृष्ठ ${page} खोल्नुहोस्`
    : "मूल PDF मा खोल्नुहोस्";
}

export function lawPdfIframeSrc(preview: SourcePdfPreview): string {
  if (preview.page != null && preview.page > 0) {
    return `${preview.src}#page=${preview.page}&view=FitH`;
  }
  return preview.src;
}
