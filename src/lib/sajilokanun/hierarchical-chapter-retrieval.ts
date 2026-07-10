/**
 * Hierarchical chapter-first retrieval:
 * 1. परिच्छेद १ — book-level intro / definitions context
 * 2. Best-matching परिच्छेद by name (LLM hints or title scoring)
 * 3. Within-chapter search — दफा title expansion + scoped vector/keyword
 */
import { buildAdvocateEmbedQuery } from "./embedding-text";
import {
  filenameMatchesScope,
  normalizeActToBookScope,
  type BookScope,
} from "./lawbooks";
import { preferredActToBookScope, queryHintToBookScope } from "./legal-retrieval-boost";
import {
  extractChapterDisplayName,
  scoreProvisionTitleMatch,
} from "./provision-title-search";
import type { QueryAnalysis } from "./query-analysis";
import {
  retrieveByKeyword,
  retrieveByVector,
  retrieveScopedSectionsBatch,
} from "./retrieve";
import { getSupabaseAdmin, type MatchedChunk } from "./supabase";
import { toArabicDigits } from "./nepali-digits";
import { toNepaliNumberDisplay } from "./nepali-digits";
import { fuseRankedListsRRF, getChapterFusionWeights } from "./rrf-fusion";

const MIN_CHAPTER_NAME_SCORE = Number(
  process.env.HIERARCHICAL_MIN_CHAPTER_SCORE ?? 0.26
);
const CHAPTER_VECTOR_CANDIDATES = Number(
  process.env.HIERARCHICAL_CHAPTER_VECTOR_K ?? 48
);
const CHAPTER_WITHIN_TOP_K = Number(
  process.env.HIERARCHICAL_CHAPTER_TOP_K ?? 12
);
const PARICHHED_ONE_CONTEXT_SIM = 0.36;
const CHAPTER_ROUTE_SIM = 0.82;
const CHAPTER_EXPAND_SIM = 0.86;

const chaptersByScope = new Map<string, string[]>();

export type HierarchicalChapterResult = {
  chunks: MatchedChunk[];
  allowedChapters: Set<string>;
  /** Chunks from परिच्छेद १ — always pinned through chapter scope filter */
  contextPinned: MatchedChunk[];
  matchedChapters: string[];
  routed: boolean;
};

function buildRoutingQuery(analysis: QueryAnalysis, queryText: string): string {
  return [
    queryText,
    analysis.originalQuery,
    analysis.intent,
    ...analysis.legalIssues,
    ...analysis.retrievalQueries,
  ]
    .filter(Boolean)
    .join(" ");
}

function scopesForRouting(
  bookScope: BookScope,
  preferredAct?: string,
  queryText?: string
): BookScope[] {
  if (bookScope !== "auto") return [bookScope];
  const fromAct = preferredActToBookScope(preferredAct);
  if (fromAct) return [fromAct];
  const fromQuery = queryText ? queryHintToBookScope(queryText) : null;
  return fromQuery ? [fromQuery] : [];
}

async function getDocumentIdsForScope(scope: BookScope): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: docs } = await supabase.from("documents").select("id, filename");
  return (docs ?? [])
    .filter((d) => filenameMatchesScope(d.filename, scope))
    .map((d) => d.id);
}

/** Distinct stored `chapter` values for one act (cached per scope). */
export async function listDistinctChaptersForScope(
  scope: BookScope
): Promise<string[]> {
  if (!scope || scope === "auto") return [];
  const cached = chaptersByScope.get(scope);
  if (cached) return cached;

  const docIds = await getDocumentIdsForScope(scope);
  if (docIds.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chunks")
    .select("chapter")
    .in("document_id", docIds)
    .not("chapter", "is", null)
    .limit(2500);

  if (error || !data?.length) return [];

  const chapters = [
    ...new Set(
      (data as Array<{ chapter: string | null }>)
        .map((row) => row.chapter?.trim())
        .filter((ch): ch is string => Boolean(ch && /परिच्छेद/u.test(ch)))
    ),
  ].sort((a, b) => {
    const na = toArabicDigits(a.match(/परिच्छेद[–\-]?\s*([\d०-९]+)/)?.[1] ?? "0");
    const nb = toArabicDigits(b.match(/परिच्छेद[–\-]?\s*([\d०-९]+)/)?.[1] ?? "0");
    return Number(na) - Number(nb);
  });

  chaptersByScope.set(scope, chapters);
  return chapters;
}

/** Resolve stored `chapter` column for a Devanagari chapter number. */
export async function resolveStoredChapter(
  scope: BookScope,
  chapterNum: string,
  name?: string
): Promise<string | null> {
  if (!scope || scope === "auto") return null;

  const nepaliNum = toNepaliNumberDisplay(toArabicDigits(chapterNum));
  const nameFrag = name?.trim().replace(/[%_]/g, "") ?? "";
  const docIds = await getDocumentIdsForScope(scope);
  if (docIds.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chunks")
    .select("chapter")
    .in("document_id", docIds)
    .ilike("chapter", `%परिच्छेद%${nepaliNum}%`)
    .limit(30);

  if (error || !data?.length) return null;

  for (const row of data as Array<{ chapter: string | null }>) {
    const ch = row.chapter?.trim();
    if (!ch) continue;
    if (nameFrag && !ch.includes(nameFrag)) continue;
    return ch;
  }

  const fallback = (data[0] as { chapter: string | null }).chapter?.trim();
  return fallback ?? null;
}

/** परिच्छेद १ intro दफा (१–३) for book-level definitions / commencement context. */
export async function retrieveParichhedOneContext(
  scope: BookScope
): Promise<MatchedChunk[]> {
  const chapter = await resolveStoredChapter(scope, "1");
  if (!chapter) return [];

  const batch = await retrieveScopedSectionsBatch(["1", "2", "3"], scope);
  const filtered = batch.filter((c) => c.chapter?.trim() === chapter);
  return filtered.map((c) => ({
    ...c,
    similarity: Math.max(c.similarity, PARICHHED_ONE_CONTEXT_SIM),
  }));
}

function scoreChapterAgainstQuery(
  query: string,
  chapter: string
): number {
  const displayName = extractChapterDisplayName(chapter);
  const fullScore = scoreProvisionTitleMatch(query, chapter);
  const nameScore = scoreProvisionTitleMatch(query, displayName);
  return Math.max(fullScore, nameScore * 1.05);
}

/** Score all chapters; return best matches above threshold. */
export async function matchBestChaptersForQuery(
  query: string,
  scope: BookScope,
  maxChapters = 2
): Promise<Array<{ chapter: string; score: number }>> {
  const chapters = await listDistinctChaptersForScope(scope);
  if (chapters.length === 0) return [];

  const scored = chapters
    .map((chapter) => ({
      chapter,
      score: scoreChapterAgainstQuery(query, chapter),
    }))
    .filter(({ chapter }) => {
      const num = toArabicDigits(
        chapter.match(/परिच्छेद[–\-]?\s*([\d०-९]+)/)?.[1] ?? ""
      );
      return num !== "1";
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const winners: Array<{ chapter: string; score: number }> = [];
  const top = scored[0];
  if (top.score < MIN_CHAPTER_NAME_SCORE) return [];

  winners.push(top);
  if (maxChapters > 1 && scored.length > 1) {
    const second = scored[1];
    if (
      second.score >= MIN_CHAPTER_NAME_SCORE &&
      second.score >= top.score * 0.72
    ) {
      winners.push(second);
    }
  }

  return winners.slice(0, maxChapters);
}

async function listChapterDafaIndex(
  chapter: string,
  scope: BookScope
): Promise<Array<{ section: string; title: string }>> {
  const docIds = await getDocumentIdsForScope(scope);
  if (docIds.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chunks")
    .select("section_label, section_title, metadata")
    .eq("chapter", chapter)
    .in("document_id", docIds)
    .limit(120);

  if (error || !data?.length) return [];

  const byDafa = new Map<string, string>();
  for (const row of data as Array<{
    section_label: string | null;
    section_title: string | null;
    metadata: Record<string, unknown> | null;
  }>) {
    const section = toArabicDigits(
      String(row.metadata?.section_dafa ?? row.section_label ?? "")
    );
    if (!section || byDafa.has(section)) continue;
    byDafa.set(section, row.section_title?.trim() ?? "");
  }

  return [...byDafa.entries()].map(([section, title]) => ({ section, title }));
}

function sectionRoot(chunk: MatchedChunk): string {
  const label = chunk.section_label?.split(".")[0]?.trim();
  return label ? toArabicDigits(label) : "";
}

/** Expand a chapter by scoring दफा titles, then fetch winning sections. */
async function expandChapterByTitleMatch(
  chapter: string,
  scope: BookScope,
  seeded: MatchedChunk[],
  queryText: string,
  maxSections = 8
): Promise<MatchedChunk[]> {
  const seededSections = new Set(
    seeded
      .filter((c) => filenameMatchesScope(c.filename, scope))
      .map(sectionRoot)
      .filter(Boolean)
  );

  const index = await listChapterDafaIndex(chapter, scope);
  if (index.length === 0) return [];

  const scored = index
    .map(({ section, title }) => ({
      section,
      score: scoreProvisionTitleMatch(queryText, title),
    }))
    .sort((a, b) => b.score - a.score);

  const toFetch: string[] = [];
  for (const { section, score } of scored) {
    if (seededSections.has(section)) continue;
    if (score < 0.1) continue;
    if (toFetch.length >= maxSections) break;
    toFetch.push(section);
    seededSections.add(section);
  }

  if (toFetch.length === 0) return [];

  const batch = await retrieveScopedSectionsBatch(toFetch, scope);
  return batch
    .filter((c) => c.chapter?.trim() === chapter)
    .map((c) => ({
      ...c,
      similarity: Math.max(c.similarity, CHAPTER_EXPAND_SIM),
    }));
}

async function retrieveVectorInChapter(
  query: string,
  chapter: string,
  scope: BookScope,
  embedText?: string
): Promise<MatchedChunk[]> {
  const vectorChunks = await retrieveByVector(
    query,
    CHAPTER_VECTOR_CANDIDATES,
    embedText
  );
  return vectorChunks
    .filter(
      (c) =>
        filenameMatchesScope(c.filename, scope) &&
        c.chapter?.trim() === chapter
    )
    .slice(0, CHAPTER_WITHIN_TOP_K)
    .map((c) => ({
      ...c,
      similarity: Math.max(c.similarity, CHAPTER_ROUTE_SIM * 0.95),
    }));
}

async function retrieveKeywordInChapter(
  query: string,
  chapter: string,
  scope: BookScope
): Promise<MatchedChunk[]> {
  const keywordChunks = await retrieveByKeyword(query, CHAPTER_WITHIN_TOP_K * 2);
  return keywordChunks
    .filter(
      (c) =>
        filenameMatchesScope(c.filename, scope) &&
        c.chapter?.trim() === chapter
    )
    .slice(0, CHAPTER_WITHIN_TOP_K)
    .map((c) => ({
      ...c,
      similarity: Math.max(c.similarity, CHAPTER_ROUTE_SIM * 0.9),
    }));
}

/** Vector + keyword + title expansion inside one matched परिच्छेद. */
export async function retrieveWithinChapterHierarchy(
  query: string,
  chapter: string,
  scope: BookScope,
  queryText: string,
  seeded: MatchedChunk[] = [],
  embedText?: string
): Promise<MatchedChunk[]> {
  const [expanded, vectorHits, keywordHits] = await Promise.all([
    expandChapterByTitleMatch(chapter, scope, seeded, queryText),
    retrieveVectorInChapter(query, chapter, scope, embedText),
    retrieveKeywordInChapter(query, chapter, scope),
  ]);

  const [vectorW, keywordW, titleW] = getChapterFusionWeights();
  const fused = fuseRankedListsRRF([vectorHits, keywordHits, expanded], {
    listNames: ["vector", "keyword", "title"],
    weights: [vectorW, keywordW, titleW],
  });

  return fused.slice(0, CHAPTER_WITHIN_TOP_K);
}

function shouldSkipHierarchicalRouting(
  query: string,
  analysis: QueryAnalysis
): boolean {
  if (/(?:^|[^\d०-९])(?:दफा|dafa|section)\s*[\d०-९]+/iu.test(query)) {
    return true;
  }
  if (/^dafa_[\w]+$/i.test(query.trim())) return true;
  if (analysis.sectionHints.length >= 1) return false;
  return false;
}

async function resolveChaptersFromHints(
  analysis: QueryAnalysis,
  bookScope: BookScope
): Promise<string[]> {
  const chapters: string[] = [];
  for (const hint of analysis.chapterHints) {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) continue;
    if (bookScope !== "auto" && scope !== bookScope) continue;
    const stored = await resolveStoredChapter(
      scope,
      hint.chapter,
      hint.name
    );
    if (stored) chapters.push(stored);
  }
  return chapters;
}

/** Map sectionHints → stored chapter column(s) for those दफा. */
export async function resolveChaptersFromSectionHints(
  analysis: QueryAnalysis,
  bookScope: BookScope
): Promise<string[]> {
  const chapters = new Set<string>();
  const byScope = new Map<BookScope, string[]>();

  for (const hint of analysis.sectionHints) {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) continue;
    if (bookScope !== "auto" && scope !== bookScope) continue;
    const list = byScope.get(scope) ?? [];
    if (!list.includes(hint.section)) list.push(hint.section);
    byScope.set(scope, list);
  }

  for (const [scope, sections] of byScope) {
    const batch = await retrieveScopedSectionsBatch(sections, scope);
    for (const chunk of batch) {
      const ch = chunk.chapter?.trim();
      if (ch) chapters.add(ch);
    }
  }

  return [...chapters];
}

async function resolveTargetChapters(
  analysis: QueryAnalysis,
  bookScope: BookScope,
  routingQuery: string,
  scope: BookScope
): Promise<string[]> {
  if (analysis.sectionHints.length > 0) {
    const fromSections = await resolveChaptersFromSectionHints(
      analysis,
      bookScope
    );
    if (fromSections.length > 0) return fromSections;
  }

  const fromHints = await resolveChaptersFromHints(analysis, bookScope);
  if (fromHints.length > 0) return fromHints;

  const scored = await matchBestChaptersForQuery(routingQuery, scope, 1);
  return scored.map((s) => s.chapter);
}

/**
 * Three-stage hierarchical retrieval for one act scope.
 * Skipped when query names a specific दफा number (deterministic path handles that).
 */
export async function runHierarchicalChapterRetrieval(
  queryText: string,
  bookScope: BookScope,
  analysis: QueryAnalysis
): Promise<HierarchicalChapterResult> {
  const empty: HierarchicalChapterResult = {
    chunks: [],
    allowedChapters: new Set(),
    contextPinned: [],
    matchedChapters: [],
    routed: false,
  };

  if (shouldSkipHierarchicalRouting(queryText, analysis)) {
    return empty;
  }

  const scopes = scopesForRouting(bookScope, analysis.preferredAct, queryText);
  if (scopes.length === 0) return empty;

  const routingQuery = buildRoutingQuery(analysis, queryText);
  const embedText = buildAdvocateEmbedQuery(routingQuery, {
    preferredAct: analysis.preferredAct,
    intent: analysis.intent,
    legalIssues: analysis.legalIssues,
  });

  const allChunks: MatchedChunk[] = [];
  const allowedChapters = new Set<string>();
  const matchedChapters: string[] = [];
  let contextPinned: MatchedChunk[] = [];

  for (const scope of scopes) {
    // परिच्छेद १ is routing context only — not included in answer chunks.
    await retrieveParichhedOneContext(scope);

    const targetChapters = await resolveTargetChapters(
      analysis,
      bookScope,
      routingQuery,
      scope
    );

    if (targetChapters.length === 0) continue;

    for (const chapter of targetChapters) {
      allowedChapters.add(chapter);
      matchedChapters.push(chapter);

      const within = await retrieveWithinChapterHierarchy(
        queryText,
        chapter,
        scope,
        routingQuery,
        allChunks,
        embedText
      );
      allChunks.push(...within);
    }
  }

  if (matchedChapters.length === 0) {
    return empty;
  }

  const byId = new Map<string, MatchedChunk>();
  for (const chunk of allChunks) {
    const existing = byId.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      byId.set(chunk.id, chunk);
    }
  }

  const deduped = [...byId.values()].sort(
    (a, b) => b.similarity - a.similarity
  );

  console.log(
    "[HandyLaw hierarchical chapter]",
    JSON.stringify(
      {
        scopes,
        matchedChapters,
        contextPinned: contextPinned.length,
        hits: deduped.slice(0, 8).map((c) => ({
          dafa: c.section_label?.split(".")[0],
          chapter: c.chapter,
          sim: Number(c.similarity.toFixed(3)),
        })),
      },
      null,
      2
    )
  );

  return {
    chunks: deduped,
    allowedChapters,
    contextPinned,
    matchedChapters,
    routed: true,
  };
}
