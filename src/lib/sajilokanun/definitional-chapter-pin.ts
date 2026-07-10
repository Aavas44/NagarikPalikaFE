/**
 * Definitional / terminology queries: definitions are often in (1) the first दफा
 * of the matched परिच्छेद, and (2) परिच्छेद १ / प्रारम्भिक (especially दफा २ परिभाषाः).
 */
import { resolveAdvocateFocusScope } from "./advocate-retrieval-policy";
import { preferredActToBookScope } from "./legal-retrieval-boost";
import { filenameMatchesScope, normalizeActToBookScope, type BookScope } from "./lawbooks";
import {
  primaryBookId,
  type ParsedBookScope,
} from "./book-scope";
import {
  retrieveParichhedOneContext,
  resolveStoredChapter,
} from "./hierarchical-chapter-retrieval";
import {
  resolveChapterForSection,
  resolveChapterStoredValue,
  resolveFirstDafaInChapter,
  retrieveScopedSectionsBatch,
} from "./retrieve";
import type { ChapterHint, QueryAnalysis, SectionHint } from "./query-analysis";
import type { MatchedChunk } from "./supabase";
import { toArabicDigits } from "./nepali-digits";

const DEFINITIONAL_TRIGGERS = [
  "के हो",
  "भन्नाले के बुझिन्छ",
  "परिभाषा",
  "भनिन्छ",
  "प्रक्रिया",
  "अर्थ",
  "कसरी",
] as const;

/** "कुन दफामा छ?" — citation lookup, not terminology definition. */
const CITATION_LOOKUP_RE =
  /कुन\s*(?:दफा|उपदफा|खण्ड)|(?:दफा|उपदफा)\s*[\d०-९]+\s*मा\s*छ|कुन\s*[\d०-९]+\s*दफा/u;

export function isDefinitionalQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (CITATION_LOOKUP_RE.test(q)) return false;
  return DEFINITIONAL_TRIGGERS.some((trigger) => q.includes(trigger));
}

/** Drop title phrases that hijack inheritance/terminology queries into wrong chapters. */
export function sanitizeDefinitionalTitleHints(analysis: QueryAnalysis): void {
  const q = `${analysis.originalQuery ?? ""} ${analysis.intent}`;
  if (!/मृत्यु|हकवाला|अपुताली|उत्तराधिकार|दायित्व.*सर्ने/i.test(q)) return;
  analysis.titleSearchHints = analysis.titleSearchHints.filter(
    (h) => !/हस्तान्तरण|transfer/i.test(h)
  );
}

function sectionRoot(chunk: MatchedChunk): string {
  const label = chunk.section_label?.split(".")[0]?.trim();
  return label ? toArabicDigits(label) : "";
}

function resolveScope(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope
): BookScope | null {
  const scoped = primaryBookId(bookScope);
  if (scoped && scoped !== "auto") return scoped;
  return (
    preferredActToBookScope(analysis.preferredAct) ??
    resolveAdvocateFocusScope(analysis, bookScope, analysis.originalQuery ?? "")
  );
}

function chapterFromChunks(
  chunks: MatchedChunk[],
  scope: BookScope
): string | null {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    if (!filenameMatchesScope(chunk.filename, scope)) continue;
    const chapter = chunk.chapter?.trim();
    if (!chapter || !/परिच्छेद/u.test(chapter)) continue;
    counts.set(chapter, (counts.get(chapter) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [chapter, count] of counts) {
    if (count > bestCount) {
      best = chapter;
      bestCount = count;
    }
  }
  return best;
}

async function resolveTargetChapter(
  chunks: MatchedChunk[],
  analysis: QueryAnalysis,
  scope: BookScope,
  preferredSections: SectionHint[] = []
): Promise<string | null> {
  for (const hint of analysis.chapterHints) {
    const hintScope = normalizeActToBookScope(hint.act);
    if (hintScope !== scope) continue;
    const chapter = await resolveChapterStoredValue(hint, scope);
    if (chapter) return chapter;
  }

  for (const hint of preferredSections.length
    ? preferredSections
    : analysis.sectionHints) {
    const hintScope = normalizeActToBookScope(hint.act);
    if (hintScope !== scope) continue;
    const chapter = await resolveChapterForSection(hint.section, scope);
    if (chapter) return chapter;
  }

  return chapterFromChunks(chunks, scope);
}

/** परिच्छेद १ (प्रारम्भिक) — दफा १–३ including book-level परिभाषा. */
export async function hydratePrarambhikDefinitionChunks(
  scope: BookScope
): Promise<{ chunks: MatchedChunk[]; chapter: string | null }> {
  const chapter =
    (await resolveStoredChapter(scope, "1", "प्रारम्भिक")) ??
    (await resolveStoredChapter(scope, "1"));
  if (!chapter) return { chunks: [], chapter: null };

  const chunks = await retrieveParichhedOneContext(scope);
  return { chunks, chapter };
}

function mergeUniqueChunks(
  primary: MatchedChunk[],
  rest: MatchedChunk[]
): MatchedChunk[] {
  const seen = new Set(primary.map((c) => c.id));
  return [...primary, ...rest.filter((c) => !seen.has(c.id))];
}

export type DefinitionalChapterPinResult = {
  chunks: MatchedChunk[];
  sectionHints: SectionHint[];
  chapterHint: ChapterHint | null;
  firstDafa: string | null;
  chapter: string | null;
  /** Stored chapter label for परिच्छेद १ / प्रारम्भिक (book-level definitions). */
  prarambhikChapter: string | null;
  scope: BookScope | null;
};

export async function applyDefinitionalChapterPin(
  chunks: MatchedChunk[],
  query: string,
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  options: { preferredSectionHints?: SectionHint[] } = {}
): Promise<DefinitionalChapterPinResult> {
  const empty: DefinitionalChapterPinResult = {
    chunks,
    sectionHints: analysis.sectionHints,
    chapterHint: null,
    firstDafa: null,
    chapter: null,
    prarambhikChapter: null,
    scope: null,
  };

  if (!isDefinitionalQuery(query)) return empty;

  const scope = resolveScope(analysis, bookScope);
  if (!scope) return empty;

  const chapter = await resolveTargetChapter(
    chunks,
    analysis,
    scope,
    options.preferredSectionHints
  );
  if (!chapter) return empty;

  const firstDafa = await resolveFirstDafaInChapter(chapter, scope);
  if (!firstDafa) return empty;

  const firstChunks = await retrieveScopedSectionsBatch([firstDafa], scope);
  if (firstChunks.length === 0) return empty;

  const prarambhik = await hydratePrarambhikDefinitionChunks(scope);

  const boosted = firstChunks.map((c) => ({
    ...c,
    similarity: Math.max(c.similarity, 0.96),
  }));

  const merged = mergeUniqueChunks(boosted, chunks);

  const numMatch = chapter.match(/परिच्छेद[–\-]?\s*([\d०-९]+)/u);
  const chapterHint: ChapterHint | null = numMatch
    ? {
        chapter: toArabicDigits(numMatch[1]),
        name: chapter.replace(/^परिच्छेद[–\-]?\s*[\d०-९]+\s*[—\-]?\s*/u, "").trim(),
        act: scope,
      }
    : null;

  const sectionHints: SectionHint[] = [
    { section: firstDafa, act: scope },
    ...analysis.sectionHints.filter(
      (h) =>
        normalizeActToBookScope(h.act) !== scope ||
        toArabicDigits(h.section) !== firstDafa
    ),
  ];

  console.log(
    "[HandyLaw definitional chapter pin]",
    JSON.stringify({
      chapter,
      firstDafa,
      prarambhikChapter: prarambhik.chapter,
      prarambhikDafa: prarambhik.chunks
        .map((c) => sectionRoot(c))
        .filter(Boolean),
      scope,
      triggers: DEFINITIONAL_TRIGGERS.filter((t) => query.includes(t)),
    })
  );

  return {
    chunks: merged,
    sectionHints,
    chapterHint,
    firstDafa,
    chapter,
    prarambhikChapter: prarambhik.chapter,
    scope,
  };
}

/** When strong pin applies, keep only first दफा + same-dafa parts for that scope. */
export function prioritizeDefinitionalFirstDafa(
  chunks: MatchedChunk[],
  scope: BookScope,
  firstDafa: string
): MatchedChunk[] {
  const primary = chunks.filter(
    (c) =>
      filenameMatchesScope(c.filename, scope) && sectionRoot(c) === firstDafa
  );
  const rest = chunks.filter(
    (c) =>
      !filenameMatchesScope(c.filename, scope) || sectionRoot(c) !== firstDafa
  );
  if (primary.length === 0) return chunks;
  return [...primary, ...rest];
}
