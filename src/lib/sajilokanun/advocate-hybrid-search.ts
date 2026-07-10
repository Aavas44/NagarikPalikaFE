import { embedQuery, isQuotaError } from "./ai";
import { citationFromChunk, parseChapterFromContent, parsePageFromContent, parseSectionLabelFromContent, parseSectionTitleFromContent, parseSubsectionFromContent } from "./chunk-metadata";
import {
  ALL_LAW_BOOK_IDS,
  filenameMatchesScope,
  normalizeActToBookScope,
} from "./lawbooks";
import {
  filenameMatchesAnyBookScope,
  primaryBookId,
  targetBookIds,
  type ParsedBookScope,
} from "./book-scope";
import { retrieveByKeyword, retrieveByVector, retrieveScopedSectionsBatch } from "./retrieve";
import { getSupabaseAdmin, type MatchedChunk } from "./supabase";
import type { QueryMetadataHint } from "./query-translate";
import { exactDafaGuessList } from "./query-translate";
import { toArabicDigits } from "./nepali-digits";

export type AdvocateHybridPayload = {
  message: string;
  searchKeywords?: string[];
  metadataHint?: QueryMetadataHint;
  bookScope: ParsedBookScope;
  /** When true, skip exact-dafa DB inject/boost — caller fuses hints via RRF separately. */
  skipExactDafaInject?: boolean;
};

type AdvocateHybridSearchRow = {
  id: string;
  book_id: string;
  act_name: string;
  dafa_no: string;
  parichhed_no: number | null;
  content: string;
  filename: string;
  section_label: string | null;
  chapter: string | null;
  section_title: string | null;
  similarity: number;
};

const DEFAULT_ACT_BOOST = 2.5;
const DEFAULT_PARICHED_BOOST = 0.8;
const DEFAULT_DAFA_RANGE_BOOST = 0.5;
const DEFAULT_EXACT_DAFA_BOOST = 1.0;
const DEFAULT_KEYWORD_BOOST = 1.5;
const DEFAULT_VECTOR_CANDIDATES = 120;
/** Floor vector score for exact-dafa chunks injected outside the KNN pool. */
const EXACT_DAFA_INJECTED_VECTOR_FLOOR = 0.35;

function mergeExactDafaCandidates(
  vectorCandidates: MatchedChunk[],
  exactChunks: MatchedChunk[]
): MatchedChunk[] {
  if (exactChunks.length === 0) return vectorCandidates;
  const byId = new Map(vectorCandidates.map((c) => [c.id, c]));
  for (const chunk of exactChunks) {
    if (!byId.has(chunk.id)) {
      byId.set(chunk.id, {
        ...chunk,
        similarity: EXACT_DAFA_INJECTED_VECTOR_FLOOR,
      });
    }
  }
  return [...byId.values()];
}

function parseBoost(envKey: string, fallback: number): number {
  const parsed = Number(process.env[envKey] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function resolveTargetBookIds(bookScope: ParsedBookScope): string[] {
  const scoped = targetBookIds(bookScope);
  if (scoped?.length) return scoped;
  return [...ALL_LAW_BOOK_IDS];
}

function resolveHintBookId(
  bookScope: ParsedBookScope,
  act?: string
): string | null {
  const scoped = targetBookIds(bookScope);
  if (scoped?.length === 1) return scoped[0];
  if (act) return normalizeActToBookScope(act);
  const primary = primaryBookId(bookScope);
  return primary !== "auto" ? primary : null;
}

function extractParichhedNo(chapter: string | null | undefined): number | null {
  if (!chapter) return null;
  const match = chapter.match(/परिच्छेद[–\-—]?\s*([०-९\d]+)/u);
  if (!match) return null;
  const n = Number(toArabicDigits(match[1]));
  return Number.isFinite(n) ? n : null;
}

function extractDafaNo(chunk: MatchedChunk): number | null {
  const fromMeta = chunk.metadata?.section_dafa;
  const raw = fromMeta ?? chunk.section_label?.split(".")[0] ?? "";
  const arabic = toArabicDigits(String(raw).replace(/[^\d०-९]/g, ""));
  const n = Number(arabic);
  return Number.isFinite(n) ? n : null;
}

function keywordFtsScore(
  chunkId: string,
  keywordHits: MatchedChunk[]
): number {
  const idx = keywordHits.findIndex((c) => c.id === chunkId);
  if (idx < 0) return 0;
  const hit = keywordHits[idx];
  return Math.min(1, hit.similarity) * parseBoost("ADVOCATE_KEYWORD_BOOST", DEFAULT_KEYWORD_BOOST);
}

export function scoreAdvocateHybridChunk(
  chunk: MatchedChunk,
  vectorScore: number,
  opts: {
    hintBookId: string | null;
    parichhed?: number | null;
    dafaStart?: number | null;
    dafaEnd?: number | null;
    exactDafas?: number[];
    keywordHits?: MatchedChunk[];
  }
): number {
  const actBoost = parseBoost("ADVOCATE_ACT_BOOST", DEFAULT_ACT_BOOST);
  const parichhedBoost = parseBoost("ADVOCATE_PARICHED_BOOST", DEFAULT_PARICHED_BOOST);
  const dafaRangeBoost = parseBoost("ADVOCATE_DAFA_RANGE_BOOST", DEFAULT_DAFA_RANGE_BOOST);
  const exactDafaBoost = parseBoost("ADVOCATE_EXACT_DAFA_BOOST", DEFAULT_EXACT_DAFA_BOOST);

  let score = vectorScore;

  if (opts.hintBookId && filenameMatchesScope(chunk.filename, opts.hintBookId)) {
    score += actBoost;
  }

  const chunkParichhed = extractParichhedNo(chunk.chapter);
  if (
    opts.parichhed != null &&
    chunkParichhed != null &&
    chunkParichhed === opts.parichhed
  ) {
    score += parichhedBoost;
  }

  const dafaNo = extractDafaNo(chunk);
  if (
    dafaNo != null &&
    opts.dafaStart != null &&
    opts.dafaEnd != null &&
    dafaNo >= opts.dafaStart &&
    dafaNo <= opts.dafaEnd
  ) {
    score += dafaRangeBoost;
  }
  const exactDafas = opts.exactDafas ?? [];
  if (dafaNo != null && exactDafas.some((d) => d === dafaNo)) {
    score += exactDafaBoost;
  }

  if (opts.keywordHits?.length) {
    score += keywordFtsScore(chunk.id, opts.keywordHits);
  }

  return score;
}

function mapHybridRows(rows: AdvocateHybridSearchRow[]): MatchedChunk[] {
  return rows.map((row) => {
    const citation = citationFromChunk(row.content, row.filename);
    return {
      id: row.id,
      content: row.content,
      filename: row.filename,
      page_number: citation.pageNumber ?? parsePageFromContent(row.content),
      section_label:
        row.section_label ??
        citation.sectionNumber ??
        parseSectionLabelFromContent(row.content),
      chapter: row.chapter ?? parseChapterFromContent(row.content),
      section_title:
        row.section_title ??
        citation.sectionTitle ??
        parseSectionTitleFromContent(row.content),
      subsection:
        citation.subsection ?? parseSubsectionFromContent(row.content),
      similarity: row.similarity,
      metadata: null,
    };
  });
}

async function retrieveAdvocateHybridSearchRpc(
  payload: AdvocateHybridPayload,
  matchCount: number,
  embedding: number[],
  keywordText: string
): Promise<MatchedChunk[] | null> {
  const { metadataHint, bookScope, skipExactDafaInject } = payload;
  const targetIds = resolveTargetBookIds(bookScope);
  const hintBookId = resolveHintBookId(bookScope, metadataHint?.act);
  const exactDafas = skipExactDafaInject ? [] : exactDafaGuessList(metadataHint);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("advocate_hybrid_search", {
    query_embedding: embedding,
    query_text: keywordText,
    target_book_ids: targetIds,
    match_count: matchCount,
    hint_act: metadataHint?.act ?? null,
    hint_book_id: hintBookId,
    hint_parichhed: null,
    hint_dafa_start: null,
    hint_dafa_end: null,
    hint_exact_dafa: exactDafas[0] ?? null,
    hint_exact_dafas: exactDafas.length > 0 ? exactDafas : null,
    vector_num_candidates: Number(
      process.env.ADVOCATE_VECTOR_CANDIDATES ?? DEFAULT_VECTOR_CANDIDATES
    ),
    act_boost: parseBoost("ADVOCATE_ACT_BOOST", DEFAULT_ACT_BOOST),
    parichhed_boost: parseBoost("ADVOCATE_PARICHED_BOOST", DEFAULT_PARICHED_BOOST),
    dafa_range_boost: parseBoost("ADVOCATE_DAFA_RANGE_BOOST", DEFAULT_DAFA_RANGE_BOOST),
    exact_dafa_boost: parseBoost("ADVOCATE_EXACT_DAFA_BOOST", DEFAULT_EXACT_DAFA_BOOST),
    keyword_boost: parseBoost("ADVOCATE_KEYWORD_BOOST", DEFAULT_KEYWORD_BOOST),
  });

  if (error) {
    if (error.message.includes("advocate_hybrid_search")) {
      console.warn(
        "[HandyLaw] advocate_hybrid_search RPC unavailable; using client-side rescoring"
      );
      return null;
    }
    throw new Error(`Advocate hybrid search failed: ${error.message}`);
  }

  return mapHybridRows((data ?? []) as AdvocateHybridSearchRow[]);
}

async function retrieveAdvocateHybridSearchFallback(
  payload: AdvocateHybridPayload,
  matchCount: number,
  embedText?: string
): Promise<MatchedChunk[]> {
  const { message, searchKeywords, metadataHint, bookScope, skipExactDafaInject } =
    payload;
  const candidateK = Number(
    process.env.ADVOCATE_VECTOR_CANDIDATES ?? DEFAULT_VECTOR_CANDIDATES
  );
  const keywordText = searchKeywords?.length
    ? searchKeywords.join(" ")
    : message;

  const [vectorCandidatesRaw, keywordHits] = await Promise.all([
    retrieveByVector(message, candidateK, embedText),
    keywordText !== message
      ? retrieveByKeyword(keywordText, Math.min(candidateK, 30))
      : Promise.resolve([] as MatchedChunk[]),
  ]);

  const vectorCandidates = vectorCandidatesRaw.filter((chunk) =>
    filenameMatchesAnyBookScope(chunk.filename, bookScope)
  );

  const exactDafas = skipExactDafaInject ? [] : exactDafaGuessList(metadataHint);
  const exactDafaChunks =
    exactDafas.length > 0
      ? await retrieveScopedSectionsBatch(
          exactDafas.map(String),
          primaryBookId(bookScope)
        )
      : [];
  const candidatePool = mergeExactDafaCandidates(
    vectorCandidates,
    exactDafaChunks
  );

  const hintBookId = resolveHintBookId(bookScope, metadataHint?.act);

  const scored = candidatePool
    .map((chunk) => ({
      ...chunk,
      similarity: scoreAdvocateHybridChunk(chunk, chunk.similarity, {
        hintBookId,
        exactDafas,
        keywordHits,
      }),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  console.log(
    "[HandyLaw advocate hybrid search]",
    JSON.stringify({
      mode: "client-fallback",
      vectorQuery: message.slice(0, 80),
      keywordQuery: keywordText.slice(0, 80),
      candidates: candidatePool.length,
      exactDafaInjected: exactDafaChunks.length,
      top: scored.slice(0, 5).map((c) => ({
        id: c.id,
        dafa: c.section_label,
        score: Number(c.similarity.toFixed(4)),
      })),
    })
  );

  return scored;
}

/**
 * Vector KNN on message (must pool) + metadata should-boosts + keyword FTS should-boost.
 * Vector KNN on message (must pool) + metadata should-boosts (act, exact dafa) + keyword FTS.
 */
export async function retrieveAdvocateHybridSearch(
  payload: AdvocateHybridPayload,
  matchCount: number,
  embedText?: string
): Promise<{ chunks: MatchedChunk[]; mode: "vector" | "keyword" }> {
  const { message, searchKeywords } = payload;
  const keywordText = searchKeywords?.length
    ? searchKeywords.join(" ")
    : message;

  let embedding: number[] | null = null;
  try {
    embedding = await embedQuery(embedText ?? message);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
  }

  if (embedding) {
    const rpcChunks = await retrieveAdvocateHybridSearchRpc(
      payload,
      matchCount,
      embedding,
      keywordText
    );
    if (rpcChunks) {
      console.log(
        "[HandyLaw advocate hybrid search]",
        JSON.stringify({
          mode: "rpc",
          vectorQuery: message.slice(0, 80),
          keywordQuery: keywordText.slice(0, 80),
          hits: rpcChunks.length,
          top: rpcChunks.slice(0, 5).map((c) => ({
            id: c.id,
            dafa: c.section_label,
            score: Number(c.similarity.toFixed(4)),
          })),
        })
      );
      return { chunks: rpcChunks, mode: "vector" };
    }
  }

  const chunks = await retrieveAdvocateHybridSearchFallback(
    payload,
    matchCount,
    embedText
  );
  return { chunks, mode: "vector" };
}
