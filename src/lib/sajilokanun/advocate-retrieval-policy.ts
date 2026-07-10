/**
 * General advocate retrieval rules — chapter routing, act scoping, homonym control.
 * Applies to every advocate query, not only topic-pin matches.
 */
import {
  filenameMatchesScope,
  LAW_BOOKS,
  normalizeActToBookScope,
  type BookScope,
} from "./lawbooks";
import {
  primaryBookId,
  targetBookIds,
  type ParsedBookScope,
} from "./book-scope";
import {
  preferredActToBookScope,
  queryHintToBookScope,
} from "./legal-retrieval-boost";
import {
  extractChapterDisplayName,
  MIN_PROVISION_TITLE_SCORE,
} from "./provision-title-search";
import { toArabicDigits } from "./nepali-digits";
import type { QueryAnalysis, SectionHint } from "./query-analysis";
import type { MatchedChunk } from "./supabase";

export type AdvocateRetrievalPolicy = {
  /** Resolved act scope for this question (user book filter, preferredAct, or query hint). */
  focusScope: BookScope | null;
  /** Limit hint retrieval to matched परिच्छेद; skip broad title search. */
  chapterScoped: boolean;
  /** Skip cross-book vector multi-search when दफा/chapter route is confident. */
  restrictGlobalMulti: boolean;
  /** After hydrate, keep only these scope|section keys (when section hints exist). */
  strictSectionKeys: Set<string> | null;
};

export function resolveAdvocateFocusScope(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  query: string
): BookScope | null {
  const scopedIds = targetBookIds(bookScope);
  if (scopedIds) return primaryBookId(bookScope);
  if (bookScope !== "auto" && !Array.isArray(bookScope)) return bookScope;
  return (
    queryHintToBookScope(query) ??
    preferredActToBookScope(analysis.preferredAct) ??
    null
  );
}

/** Drop LLM section/chapter hints from wrong acts; align preferredAct with focus scope. */
export function sanitizeAdvocateAnalysis(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  query: string
): QueryAnalysis {
  const scopedIds = targetBookIds(bookScope);
  if (scopedIds) {
    const allowed = new Set(scopedIds);
    const sectionHints = analysis.sectionHints.filter((h) => {
      const scope = normalizeActToBookScope(h.act);
      return scope && allowed.has(scope);
    });
    const chapterHints = analysis.chapterHints.filter((h) => {
      const scope = normalizeActToBookScope(h.act);
      return scope && allowed.has(scope);
    });
    const preferredAct =
      analysis.preferredAct && allowed.has(analysis.preferredAct)
        ? analysis.preferredAct
        : scopedIds[0];
    return { ...analysis, sectionHints, chapterHints, preferredAct };
  }

  const focusScope = resolveAdvocateFocusScope(analysis, bookScope, query);
  if (!focusScope) return analysis;

  const sectionHints = analysis.sectionHints.filter(
    (h) => normalizeActToBookScope(h.act) === focusScope
  );
  const chapterHints = analysis.chapterHints.filter(
    (h) => normalizeActToBookScope(h.act) === focusScope
  );

  return {
    ...analysis,
    sectionHints,
    chapterHints,
    preferredAct: analysis.preferredAct || focusScope,
  };
}

export function sectionHintKeys(hints: SectionHint[]): Set<string> {
  const keys = new Set<string>();
  for (const hint of hints) {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) continue;
    keys.add(`${scope}|${toArabicDigits(hint.section)}`);
  }
  return keys;
}

function chunkSectionKey(chunk: MatchedChunk): string | null {
  for (const book of LAW_BOOKS) {
    if (!filenameMatchesScope(chunk.filename, book.id)) continue;
    const root = chunk.section_label?.split(".")[0]?.trim();
    if (!root) return null;
    return `${book.id}|${toArabicDigits(root)}`;
  }
  return null;
}

/** Keep only chunks for explicitly hinted दफा (prevents hydrate / title spillover). */
export function filterToSectionHints(
  chunks: MatchedChunk[],
  sectionHints: SectionHint[]
): MatchedChunk[] {
  if (sectionHints.length === 0) return chunks;
  const allowed = sectionHintKeys(sectionHints);
  if (allowed.size === 0) return chunks;
  return chunks.filter((c) => {
    const key = chunkSectionKey(c);
    return key !== null && allowed.has(key);
  });
}

export function filterToAllowedChapters(
  chunks: MatchedChunk[],
  allowedChapters: Set<string>
): MatchedChunk[] {
  if (allowedChapters.size === 0) return chunks;
  return chunks.filter((c) => {
    const ch = c.chapter?.trim();
    return ch && allowedChapters.has(ch);
  });
}

export function buildAdvocateRetrievalPolicy(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  query: string,
  options: { fromTopicPin?: boolean } = {}
): AdvocateRetrievalPolicy {
  const focusScope = resolveAdvocateFocusScope(analysis, bookScope, query);

  const hintActs = new Set(
    analysis.sectionHints
      .map((h) => normalizeActToBookScope(h.act))
      .filter((s): s is BookScope => Boolean(s))
  );

  const hasSectionHints = analysis.sectionHints.length > 0;
  const hasChapterHints = analysis.chapterHints.length > 0;
  const singleActSectionHints = hintActs.size === 1;

  const chapterScoped =
    hasSectionHints ||
    hasChapterHints ||
    Boolean(focusScope && focusScope !== "auto");

  const restrictGlobalMulti =
    Boolean(options.fromTopicPin) ||
    (hasSectionHints && singleActSectionHints && Boolean(focusScope));

  const strictSectionKeys =
    hasSectionHints && focusScope ? sectionHintKeys(analysis.sectionHints) : null;

  return {
    focusScope,
    chapterScoped,
    restrictGlobalMulti,
    strictSectionKeys,
  };
}

export function shouldRunTitleSearchInHints(
  analysis: QueryAnalysis,
  chapterScoped: boolean
): boolean {
  if (chapterScoped) return false;
  return analysis.titleSearchHints.length > 0;
}

/** When embedded title search pins a दफा, override noisy LLM section hints. */
export function applyEmbeddedTitleMatchToAnalysis(
  analysis: QueryAnalysis,
  chunks: MatchedChunk[],
  titleScore = 0
): MatchedChunk[] {
  if (chunks.length === 0) return chunks;
  if (titleScore < MIN_PROVISION_TITLE_SCORE) {
    return chunks.map((c) => ({
      ...c,
      similarity: Math.max(c.similarity, 0.91),
    }));
  }

  const chunk = chunks[0];
  const root = chunk.section_label?.split(".")[0]?.trim();
  if (!root) return chunks;

  let act: BookScope | null = null;
  for (const book of LAW_BOOKS) {
    if (filenameMatchesScope(chunk.filename, book.id)) {
      act = book.id;
      break;
    }
  }
  if (!act) return chunks;

  const sectionHint: SectionHint = { section: root, act };
  analysis.sectionHints = [sectionHint];
  analysis.preferredAct = act;

  const chapter = chunk.chapter?.trim();
  if (chapter) {
    const numMatch = chapter.match(/परिच्छेद\s*([\d०-९]+)/u);
    if (numMatch) {
      analysis.chapterHints = [
        {
          chapter: toArabicDigits(numMatch[1]),
          name: extractChapterDisplayName(chapter),
          act,
        },
      ];
    }
  }

  return chunks.map((c) => ({
    ...c,
    similarity: Math.max(c.similarity, 0.93),
  }));
}

/** बिगो execution (दफा २४२) vs court-fee मिलापत्र (दफा ८२) — drop ८२ when query is बिगो-only. */
export function dropBigoCourtFeeCollision(
  chunks: MatchedChunk[],
  query: string
): MatchedChunk[] {
  const isBigoExecution =
    /बिगो\s*(भराउने|बुझाउन|भरी|असुल)/u.test(query) ||
    /बिगो\s*भराउने\s*कार्यविधि/u.test(query);
  const isCourtFeeSettlement =
    /मिलापत्र|मेलमिलाप|अदालती\s*शुल्क|फिर्ता/u.test(query);
  if (!isBigoExecution || isCourtFeeSettlement) {
    chunks = dropMisilDhulyauCourtFeeCollision(chunks, query);
    return chunks;
  }

  const filtered = chunks.filter((c) => {
    if (!filenameMatchesScope(c.filename, "civil-procedure")) return true;
    const root = toArabicDigits(c.section_label?.split(".")[0] ?? "");
    return root !== "82";
  });
  return filtered.length > 0 ? filtered : chunks;
}

/** मिसिल धुल्याउ (दफा २८५) vs अदालती शुल्क दफा ८२. */
function dropMisilDhulyauCourtFeeCollision(
  chunks: MatchedChunk[],
  query: string
): MatchedChunk[] {
  const isMisilDhulyau =
    /धुल्याउ/u.test(query) && /मिसिल/u.test(query);
  const isCourtFeeSettlement =
    /मिलापत्र|मेलमिलाप|अदालती\s*शुल्क|फिर्ता/u.test(query);
  if (!isMisilDhulyau || isCourtFeeSettlement) return chunks;

  const filtered = chunks.filter((c) => {
    if (!filenameMatchesScope(c.filename, "civil-procedure")) return true;
    const root = toArabicDigits(c.section_label?.split(".")[0] ?? "");
    return root !== "82";
  });
  return filtered.length > 0 ? filtered : chunks;
}
