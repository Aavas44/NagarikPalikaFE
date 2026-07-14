import { embedQuery, isQuotaError } from "./ai";
import {
  citationFromChunk,
  formatCitationBlock,
  parseChapterFromContent,
  parsePageFromContent,
  parseSectionLabelFromContent,
  parseSectionTitleFromContent,
  parseSubsectionFromContent,
} from "./chunk-metadata";
import { getSupabaseAdmin, type MatchedChunk } from "./supabase";
import {
  bookFilterForScope,
  filenameMatchesScope,
  filterChunksToBookScope,
  LAW_BOOKS,
  normalizeActToBookScope,
  type BookScope,
} from "./lawbooks";
import {
  preferredActToBookScope,
  queryHintToBookScope,
  rerankWithActBoost,
  isJaheriRegistrationRefusalQuery,
  supplementalRetrievalQueries,
  supplementalSectionNumbers,
  supplementalSectionLookups,
  buildTitleSearchPhrases,
} from "./legal-retrieval-boost";
import { buildAdvocateEmbedQuery } from "./embedding-text";
import { rankSectionChunks, sectionChunkQuality, isFormOrJunkSection } from "./chunk-quality";
import { hierarchySortKeyFromMetadata, parseProvisionPath, sortChunksHierarchically } from "./hierarchical-section";
import { getProvisionBody, cleanProvisionBodyForDisplay } from "./provision-body";
import { toNepaliNumberDisplay } from "./nepali-digits";
import { withDbRetry } from "./db-retry";
import {
  extractChapterDisplayName,
  isProvisionTitleQuery,
  expandProvisionTitleQuery,
  MIN_PROVISION_TITLE_SCORE,
  pickTitleSearchAnchor,
  pickTitleSearchAnchors,
  scoreProvisionTitleMatch,
  mergeProvisionTitleSearchCandidates,
  extractProvisionTitleCandidates,
  topProvisionTitleCandidates,
} from "./provision-title-search";
import type { ChapterHint, QueryAnalysis } from "./query-analysis";
import {
  fuseRankedListsRRF,
  getHybridCandidateMultiplier,
  getHybridFusionWeights,
} from "./rrf-fusion";
import {
  filenameMatchesAnyBookScope,
  primaryBookId,
  targetBookIds,
  type ParsedBookScope,
} from "./book-scope";
import { UI_SOURCES_PANEL_MAX } from "./source-label";

const TOP_K = Number(process.env.RETRIEVAL_TOP_K ?? 8);
const SECTION_TOP_K = Number(process.env.SECTION_RETRIEVAL_TOP_K ?? 24);
export const ADVOCATE_TOP_K = Number(process.env.ADVOCATE_RETRIEVAL_TOP_K ?? 24);
export const ADVOCATE_CONTEXT_MAX = Number(
  process.env.ADVOCATE_CONTEXT_MAX ?? 18
);
/** Unique दफा sent to विस्तृत स्रोत in advocate mode (LLM context uses ADVOCATE_CONTEXT_MAX). */
export const ADVOCATE_UI_SOURCES_MAX = Number(
  process.env.ADVOCATE_UI_SOURCES_MAX ?? UI_SOURCES_PANEL_MAX
);
const PINNED_SIMILARITY = 0.84;
const CHAPTER_EXPANSION_MAX_SECTIONS = Number(
  process.env.CHAPTER_EXPANSION_MAX_SECTIONS ?? 6
);
const CHAPTER_EXPAND_SIMILARITY = 0.87;
const MIN_SECTION_HINTS_SKIP_EXPANSION = Number(
  process.env.ADVOCATE_MIN_SECTION_HINTS_SKIP_EXPANSION ?? 2
);

const documentIdsByScope = new Map<string, string[]>();

async function getDocumentIdsForBookScope(scope: BookScope): Promise<string[]> {
  if (!scope || scope === "auto") {
    const cacheKey = "all";
    const cached = documentIdsByScope.get(cacheKey);
    if (cached) return cached;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("documents").select("id");
    const ids = (data ?? []).map((d) => d.id);
    documentIdsByScope.set(cacheKey, ids);
    return ids;
  }

  const cached = documentIdsByScope.get(scope);
  if (cached) return cached;

  const supabase = getSupabaseAdmin();
  const { data: docs } = await supabase.from("documents").select("id, filename");
  const ids = (docs ?? [])
    .filter((d) => filenameMatchesScope(d.filename, scope))
    .map((d) => d.id);
  documentIdsByScope.set(scope, ids);
  return ids;
}

const STOP_WORDS = new Set([
  "गरेमा", "गर्दा", "हुन्छ", "हो", "कस्तो", "के", "कुन", "का", "को",
  "मा", "ले", "र", "वा", "छ", "भन्ने", "what", "is", "the", "how",
  "when", "for", "a", "an",
]);

export type RetrievalMode = "vector" | "keyword" | "auto";

export function getRetrievalMode(): RetrievalMode {
  const mode = process.env.RETRIEVAL_MODE ?? "auto";
  if (mode === "vector" || mode === "keyword" || mode === "auto") return mode;
  return "auto";
}

function queryWords(query: string): string[] {
  const words = query
    .split(/[\s,।.?!;:]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word.toLowerCase()));
  return words.length > 0 ? words : [query.trim()].filter(Boolean);
}

function scoreChunk(
  content: string,
  sectionLabel: string | null,
  words: string[]
): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (lower.includes(word.toLowerCase())) score += 1;
  }
  if (sectionLabel && words.some((w) => sectionLabel.includes(w))) score += 1;
  if (/सजाय|जन्मकैद|कैद|जरिवाना|उपदफा/.test(content) && score > 0) score += 0.5;
  return score;
}

function toArabicDigits(s: string): string {
  const map: Record<string, string> = {
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  };
  return s.replace(/[०-९]/g, (c) => map[c] ?? c);
}

/** Aligns with scripts/parse_nepali_law.py CLAUSE_ROMAN */
const CLAUSE_ROMAN: Record<string, string> = {
  "क": "ka",
  "ख": "kha",
  "ग": "ga",
  "घ": "gha",
  "ङ": "nga",
  "च": "cha",
  "छ": "chha",
  "ज": "ja",
  "झ": "jha",
  "ञ": "nya",
  "ट": "ta",
  "ठ": "tha",
  "ड": "da",
  "ढ": "dha",
  "ण": "na",
  "त": "ta2",
  "थ": "tha2",
  "द": "da2",
  "ध": "dha2",
  "न": "na2",
  "प": "pa",
  "फ": "pha",
  "ब": "ba",
  "भ": "bha",
  "म": "ma",
  "य": "ya",
  "र": "ra",
  "ल": "la",
  "व": "va",
  "श": "sha",
  "ष": "sha2",
  "स": "sa",
  "ह": "ha",
};

function slugDafa(num: string): string {
  const digits: string[] = [];
  let letterSuffix = "";
  for (const ch of num.replace(/\./g, "").replace(/\s+/g, "")) {
    if (/[\d०-९]/.test(ch)) {
      digits.push(toArabicDigits(ch));
    } else if (CLAUSE_ROMAN[ch]) {
      letterSuffix += CLAUSE_ROMAN[ch];
    } else if (/^[a-z]+$/i.test(ch)) {
      letterSuffix += ch.toLowerCase();
    }
  }
  return `${digits.join("")}${letterSuffix}`;
}

function khandaSlug(khanda: string): string {
  const trimmed = khanda.replace(/[()]/g, "").trim();
  return CLAUSE_ROMAN[trimmed] ?? trimmed.toLowerCase();
}

/** Extract खण्ड letter from query — supports shorthand "दफा २ को क", "dafa 2 ko ka", etc. */
function extractKhandaFromQuery(
  query: string,
  hasUpadafa: boolean
): string | null {
  const khandaParen = query.match(/\(([क-ह])\)/);
  if (khandaParen) return khandaParen[1];

  const khandaLabel = query.match(
    /(?:खण्ड|khanda|khand|clause)\s*[(:]?\s*([क-ह]|[a-z]{1,4})\s*[)]?/i
  );
  if (khandaLabel) return khandaLabel[1];

  // दफा २ को क / dafa 2 ko ka — letter after को at end of query
  const afterKo = query.match(
    /(?:ko|को)\s*(?:खण्ड\s*)?(?:\(([क-ह])\)|([क-ह])|(ka|kha|ga|gha|nga|cha|chha|ja|jha|nya|ta|tha|da|dha|na|pa|pha|ba|bha|ma|ya|ra|la|va|sha|sa|ha))\s*$/i
  );
  if (afterKo) return afterKo[1] ?? afterKo[2] ?? afterKo[3];

  if (hasUpadafa) {
    const khandaRoman = query.match(
      /(?:upadafa|उपदफा)\s*[\d०-९]+\s*(?:ko|को)?\s*\b(ka|kha|ga|gha|nga|cha|chha|ja|jha|nya|ta|tha|da|dha|na|pa|pha|ba|bha|ma|ya|ra|la|va|sha|sa|ha)\b/i
    );
    if (khandaRoman) return khandaRoman[1];
  }

  return null;
}

function buildDafaChunkId(
  dafa: string,
  upadafa: string | null,
  khanda: string | null
): string {
  const base = `dafa_${slugDafa(dafa)}`;
  if (!upadafa) return base;
  const up = toArabicDigits(upadafa);
  if (!khanda) return `${base}_upadafa_${up}`;
  return `${base}_upadafa_${up}_${khandaSlug(khanda)}`;
}

/** e.g. "dafa 2 ko upadafa 1 ka" → dafa_2_upadafa_1_ka */
function buildChunkIdFromNaturalQuery(query: string): string | null {
  const dafaMatch = query.match(
    /(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*([\d०-९]+(?:[क-ह])?)/i
  );
  if (!dafaMatch) return null;

  const upadafaMatch = query.match(
    /(?:उपदफा|upadafa|upa[- ]?dafa|sub[- ]?section)\s*([\d०-९]+)/i
  );
  const upadafa = upadafaMatch ? toArabicDigits(upadafaMatch[1]) : null;
  const khanda = extractKhandaFromQuery(query, Boolean(upadafaMatch));

  if (!upadafa && !khanda) return null;
  // e.g. "dafa 2 ko khanda ka" — resolve via metadata (upadafa varies by book)
  if (!upadafa && khanda) return null;

  return buildDafaChunkId(dafaMatch[1], upadafa, khanda);
}

export function extractSectionFromQuery(query: string): string | null {
  const match = query.match(
    /(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*([\d०-९]+)/i
  );
  if (match) return toArabicDigits(match[1]);

  const glued = query.match(/\b(?:dafa|daafa|dapha)(\d+)\b/i);
  if (glued) return glued[1];

  return null;
}

export type StructuredLegalRef = {
  chunkId: string | null;
  sectionDafa: string | null;
  upadafa: string | null;
  khanda: string | null;
};

export function extractStructuredLegalRef(query: string): StructuredLegalRef {
  const chunkId = extractChunkIdFromQuery(query);
  const sectionDafa = extractSectionFromQuery(query);

  const upadafaMatch = query.match(
    /(?:उपदफा|upadafa|upa[- ]?dafa|sub[- ]?section)\s*([\d०-९]+)/i
  );
  let upadafa = upadafaMatch ? toArabicDigits(upadafaMatch[1]) : null;

  if (!upadafa && sectionDafa) {
    const koPattern = query.match(
      /(?:दफा|dafa|section)\s*[\d०-९]+\s*(?:को|ko)\s*([\d०-९]+)/i
    );
    if (koPattern) upadafa = toArabicDigits(koPattern[1]);
  }

  const khanda = extractKhandaFromQuery(query, Boolean(upadafaMatch || upadafa));

  return { chunkId, sectionDafa, upadafa, khanda };
}

/** e.g. dafa_2_upadafa_1_ka, sec_20_sub_2_kha, or "dafa 2 ko upadafa 1 ka" */
export function extractChunkIdFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (/^(?:dafa|sec)_[\w\u0900-\u097F]+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return buildChunkIdFromNaturalQuery(trimmed);
}

/** Prefer a specific act when the query names it (e.g. कार्यविधि dafa 2). */
export function extractBookFilter(query: string): RegExp | null {
  if (/देवानी.*कार्यविधि|devani.*karyavidhi|karyavidhi/i.test(query)) {
    return /देवानी.*कार्यविधि|devani.*karyavidhi|muluki[_\s-]?devani[_\s-]?karyavidhi/i;
  }
  if (/फौजदारी.*कार्यविधि|faujdar|faujdari|criminal procedure/i.test(query)) {
    return /फौजदारी.*कार्यविधि|faujdar|faujdari/i;
  }
  if (/अपराध.*संहिता|aparadh|criminal code/i.test(query)) {
    return /अपराध.*संहिता|aparadh/i;
  }
  return null;
}

/** UI book selection overrides query hints when not Auto. */
export function resolveBookFilter(
  bookScope: ParsedBookScope,
  query: string
): RegExp | null {
  if (targetBookIds(bookScope)) return null;
  const scoped = bookFilterForScope(primaryBookId(bookScope));
  if (scoped) return scoped;
  return extractBookFilter(query);
}

type CrossBookSearchRow = {
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

/** Metadata-bounded vector + FTS search within explicit book ids (Supabase RPC). */
export async function retrieveByCrossBookSearch(
  query: string,
  targetIds: string[],
  matchCount: number,
  embedText?: string
): Promise<MatchedChunk[]> {
  if (targetIds.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { count: embeddedCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  let embedding: number[] | null = null;
  if ((embeddedCount ?? 0) > 0) {
    try {
      embedding = await embedQuery(embedText ?? query);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
    }
  }

  const { data, error } = await supabase.rpc("cross_book_legal_search", {
    query_embedding: embedding ?? new Array(768).fill(0),
    query_text: query,
    target_book_ids: targetIds,
    match_count: matchCount,
  });

  if (error) {
    if (error.message.includes("cross_book_legal_search")) {
      console.warn(
        "[HandyLaw] cross_book_legal_search RPC unavailable; using legacy retrieval"
      );
      return [];
    }
    throw new Error(`Cross-book search failed: ${error.message}`);
  }

  const chunks = ((data ?? []) as CrossBookSearchRow[])
    .map((row) =>
      enrichChunk({
        id: row.id,
        content: row.content,
        filename: row.filename,
        page_number: null,
        section_label: row.section_label,
        chapter: row.chapter,
        section_title: row.section_title,
        similarity: row.similarity,
      })
    )
    .filter((chunk) =>
      targetIds.some((id) => filenameMatchesScope(chunk.filename, id))
    );
  const withSiblings = await fetchSiblingChunks(chunks);
  return withSiblings.filter((chunk) =>
    targetIds.some((id) => filenameMatchesScope(chunk.filename, id))
  );
}

/** Order sub-parts: main chunk → char-split continuations (2.8.x) → numbered sub-items. */
function sectionPartOrder(
  sectionLabel: string | null | undefined,
  sectionNum: string
): number {
  if (!sectionLabel || sectionLabel === sectionNum) return 0;
  if (new RegExp(`^${sectionNum}\\.8(?:\\.|$)`).test(sectionLabel)) return 1;
  const suffix = sectionLabel.replace(`${sectionNum}.`, "");
  if (/^[1-7](?:\.|$)/.test(suffix)) return 3;
  return 2;
}

function compareSectionParts(
  a: MatchedChunk,
  b: MatchedChunk,
  sectionNum: string
): number {
  const book = a.filename.localeCompare(b.filename);
  if (book !== 0) return book;
  const order =
    sectionPartOrder(a.section_label, sectionNum) -
    sectionPartOrder(b.section_label, sectionNum);
  if (order !== 0) return order;
  return (a.page_number ?? 0) - (b.page_number ?? 0);
}

function dedupeSectionChunks(chunks: MatchedChunk[]): MatchedChunk[] {
  const byKey = new Map<string, MatchedChunk>();
  for (const chunk of chunks) {
    const key = `${chunk.filename}|${chunk.section_label ?? ""}`;
    const existing = byKey.get(key);
    if (!existing || chunk.content.length > existing.content.length) {
      byKey.set(key, chunk);
    }
  }
  return [...byKey.values()];
}

function enrichChunk(
  row: {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    section_title?: string | null;
    filename: string;
    similarity: number;
    metadata?: Record<string, unknown> | null;
  }
): MatchedChunk {
  const citation = citationFromChunk(row.content, row.filename);
  return {
    id: row.id,
    content: row.content,
    filename: row.filename,
    page_number:
      row.page_number ?? citation.pageNumber ?? parsePageFromContent(row.content),
    section_label:
      row.section_label ??
      citation.sectionNumber ??
      parseSectionLabelFromContent(row.content),
    chapter:
      row.chapter ?? parseChapterFromContent(row.content),
    section_title:
      row.section_title ??
      citation.sectionTitle ??
      parseSectionTitleFromContent(row.content),
    subsection:
      citation.subsection ?? parseSubsectionFromContent(row.content),
    similarity: row.similarity,
    metadata: row.metadata ?? null,
  };
}

function parseReferencesFromMetadata(
  metadata?: Record<string, unknown> | null
): StructuredLegalRef[] {
  const raw = metadata?.references;
  if (!Array.isArray(raw)) return [];
  const out: StructuredLegalRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const sectionDafa = r.section_dafa;
    if (typeof sectionDafa !== "string" || !sectionDafa.trim()) continue;
    const upa = r.subsection_upadafa;
    const kh = r.clause_khanda;
    out.push({
      chunkId: null,
      sectionDafa: toArabicDigits(sectionDafa),
      upadafa:
        typeof upa === "string" && upa.trim()
          ? toArabicDigits(upa)
          : null,
      khanda:
        typeof kh === "string" && kh.trim()
          ? kh.replace(/[()]/g, "").trim()
          : null,
    });
  }
  return out;
}

function referenceKey(ref: StructuredLegalRef): string {
  return `${ref.sectionDafa ?? ""}|${ref.upadafa ?? ""}|${ref.khanda ?? ""}`;
}

function parseChapterHadamyadFromMetadata(
  metadata?: Record<string, unknown> | null
): string | null {
  const raw = metadata?.chapter_hadamyad_dafa;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return toArabicDigits(raw);
}

function isHadamyadProvision(chunk: MatchedChunk): boolean {
  if (chunk.metadata?.provision_role === "hadamyad") return true;
  const title = chunk.section_title ?? "";
  if (/हदम्याद/u.test(title)) return true;
  const metaTitle = chunk.metadata?.section_title;
  if (typeof metaTitle === "string" && /हदम्याद/u.test(metaTitle)) return true;
  return false;
}

function parichhedScopeKey(chunk: MatchedChunk): string | null {
  const chapter = chunk.chapter?.trim();
  if (!chapter || !/परिच्छेद/u.test(chapter)) return null;
  const num = chapter.match(/परिच्छेद[–\-]?\s*([\d०-९]+)/)?.[1];
  if (!num) return `${chunk.filename}|${chapter}`;
  return `${chunk.filename}|${toArabicDigits(num)}`;
}

type ChapterHadamyadTarget = {
  filename: string;
  parichhedNum: string;
  sectionDafa?: string;
};

async function resolveHadamyadSectionForChapter(
  target: ChapterHadamyadTarget,
  bookScope: BookScope
): Promise<string | null> {
  if (target.sectionDafa) return target.sectionDafa;

  const supabase = getSupabaseAdmin();
  const nepaliNum = toNepaliNumberDisplay(target.parichhedNum);
  const chapterPattern = `%परिच्छेद%${nepaliNum}%`;

  type Row = {
    section_label?: string | null;
    section_title?: string | null;
    metadata?: Record<string, unknown> | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  const { data, error } = await supabase
    .from("chunks")
    .select(
      "section_label, section_title, metadata, documents(filename)"
    )
    .ilike("chapter", chapterPattern)
    .ilike("section_title", "%हदम्याद%")
    .limit(30);

  if (error) {
    if (
      error.message.includes("section_title") ||
      error.message.includes("chapter")
    ) {
      return null;
    }
    throw new Error(`Chapter हदम्याद lookup failed: ${error.message}`);
  }

  for (const row of (data ?? []) as unknown as Row[]) {
    const doc = row.documents;
    const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
    if (!filename || !filenameMatchesScope(filename, bookScope)) continue;
    if (target.filename !== "unknown" && filename !== target.filename) continue;

    const fromMeta = row.metadata?.section_dafa;
    if (typeof fromMeta === "string" && fromMeta.trim()) {
      return toArabicDigits(fromMeta);
    }
    const fromLabel = row.section_label?.split(".")[0]?.trim();
    if (fromLabel) return toArabicDigits(fromLabel);
  }

  return null;
}

/** Pull the परिच्छेद–level हदम्याद दफा when primary hits share a chapter. */
export async function hydrateChapterHadamyadChunks(
  chunks: MatchedChunk[],
  bookScope: BookScope
): Promise<MatchedChunk[]> {
  if (chunks.length === 0) return chunks;

  const chapterTargets = new Map<string, ChapterHadamyadTarget>();
  const chapterHasHadamyad = new Set<string>();

  for (const chunk of chunks) {
    const key = parichhedScopeKey(chunk);
    if (!key) continue;

    if (isHadamyadProvision(chunk)) {
      chapterHasHadamyad.add(key);
      continue;
    }

    const hadamyadDafa = parseChapterHadamyadFromMetadata(chunk.metadata);
    const parichhedNum = key.split("|")[1] ?? "";
    const existing = chapterTargets.get(key);
    chapterTargets.set(key, {
      filename: chunk.filename,
      parichhedNum,
      sectionDafa: hadamyadDafa ?? existing?.sectionDafa,
    });
  }

  const fetchTargets: Array<{ key: string; target: ChapterHadamyadTarget }> =
    [];
  for (const [key, target] of chapterTargets) {
    if (chapterHasHadamyad.has(key)) continue;
    fetchTargets.push({ key, target });
  }

  if (fetchTargets.length === 0) return chunks;

  const hydrated: MatchedChunk[] = [...chunks];
  const seen = new Set(chunks.map((c) => c.id));
  const seenSections = new Set(
    chunks.map((c) => `${bookScopeFromFilename(c.filename)}|${sectionRootLabel(c)}`)
  );

  for (const { target } of fetchTargets) {
    const sectionDafa = await resolveHadamyadSectionForChapter(
      target,
      bookScope
    );
    if (!sectionDafa) continue;

    const scope =
      bookScope !== "auto"
        ? bookScope
        : bookScopeFromFilename(target.filename) ?? bookScope;
    if (scope === "auto") continue;

    const sectionKey = `${scope}|${sectionDafa}`;
    if (seenSections.has(sectionKey)) continue;

    const raw = await retrieveScopedSectionsBatch([sectionDafa], scope);
    const parts = dedupeAdvocateSectionParts(repairMisplacedUpadafaParts(raw));
    if (parts.length === 0) continue;

    seenSections.add(sectionKey);
    for (const part of parts) {
      if (!filenameMatchesScope(part.filename, scope)) continue;
      if (seen.has(part.id)) continue;
      seen.add(part.id);
      hydrated.push({
        ...part,
        similarity: Math.max(part.similarity, 0.8),
      });
    }
  }

  return sortChunksHierarchically(hydrated);
}

/** Cross-refs + परिच्छेद हदम्याद hydration. */
export async function hydrateLinkedProvisionChunks(
  chunks: MatchedChunk[],
  bookScope: BookScope
): Promise<MatchedChunk[]> {
  const withRefs = await hydrateReferencedChunks(chunks, bookScope);
  return hydrateChapterHadamyadChunks(withRefs, bookScope);
}

/** Pull chunks cited inline (दफा N खण्ड, उपदफा (M) बमोजिम) from metadata.references. */
export async function hydrateReferencedChunks(
  chunks: MatchedChunk[],
  bookScope: BookScope
): Promise<MatchedChunk[]> {
  if (chunks.length === 0) return chunks;

  const refTargets = new Map<string, StructuredLegalRef>();
  for (const chunk of chunks) {
    for (const ref of parseReferencesFromMetadata(chunk.metadata)) {
      const key = referenceKey(ref);
      if (!refTargets.has(key)) refTargets.set(key, ref);
    }
  }

  if (refTargets.size === 0) return chunks;

  const hydrated: MatchedChunk[] = [...chunks];
  const seen = new Set(chunks.map((c) => c.id));

  for (const ref of refTargets.values()) {
    let fetched: MatchedChunk[] = [];
    if (ref.upadafa || ref.khanda) {
      fetched = await retrieveByMetadataRef(ref, bookScope);
    } else if (ref.sectionDafa) {
      fetched = await retrieveBySectionMetadata(ref.sectionDafa, bookScope);
    }
    for (const part of fetched) {
      if (seen.has(part.id)) continue;
      seen.add(part.id);
      hydrated.push({
        ...part,
        similarity: Math.max(part.similarity, 0.82),
      });
    }
  }

  return sortChunksHierarchically(hydrated);
}

async function retrieveByChunkId(
  chunkId: string,
  bookScope: BookScope = "auto"
): Promise<MatchedChunk[]> {
  const supabase = getSupabaseAdmin();

  type ChunkRow = {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    section_title?: string | null;
    chunk_id?: string | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  const { data, error } = await supabase
    .from("chunks")
    .select(
      "id, content, page_number, section_label, chapter, section_title, chunk_id, documents(filename)"
    )
    .eq("chunk_id", chunkId)
    .limit(10);

  if (error) {
    if (error.message.includes("chunk_id")) return [];
    throw new Error(`Chunk ID retrieval failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ChunkRow[];
  const matched = rows
    .map((row) => {
      const doc = row.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      return enrichChunk({
        id: row.id,
        content: row.content,
        filename: filename ?? "unknown",
        page_number: row.page_number,
        section_label: row.section_label ?? null,
        chapter: row.chapter ?? null,
        section_title: row.section_title ?? null,
        similarity: 1,
      });
    })
    .filter((chunk) => filenameMatchesScope(chunk.filename, bookScope));

  return matched;
}

function chunkTypeOrder(metadata?: Record<string, unknown> | null): number {
  return hierarchySortKeyFromMetadata(metadata);
}

function isContaminatedIndexedChunk(row: {
  content: string;
  section_title?: string | null;
}): boolean {
  const body = cleanProvisionBodyForDisplay(getProvisionBody(row.content));
  const title = row.section_title ?? "";
  if (!title.includes("आक्रमण गर्न नहुने")) return false;
  return /संसदलाई|धम्की दिन/.test(body);
}

function dedupeIndexedChunks<
  T extends { id: string; chunk_id?: string | null; content: string; section_title?: string | null; metadata?: Record<string, unknown> | null }
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];

  for (const row of rows) {
    if (isContaminatedIndexedChunk(row)) continue;
    const body = cleanProvisionBodyForDisplay(getProvisionBody(row.content));
    const key = `${row.chunk_id ?? row.id}|${body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }

  return kept;
}

async function retrieveSectionsByMetadataBatch(
  sectionNums: string[],
  bookScope: ParsedBookScope = "auto"
): Promise<MatchedChunk[]> {
  if (sectionNums.length === 0) return [];

  const sectionNepalis = [
    ...new Set(sectionNums.map((s) => toNepaliNumberDisplay(s))),
  ];
  const supabase = getSupabaseAdmin();

  type ChunkRow = {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    section_title?: string | null;
    chunk_id?: string | null;
    metadata?: Record<string, unknown> | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  const data = await withDbRetry(async () => {
    const result = await supabase
      .from("chunks")
      .select(
        "id, content, page_number, section_label, chapter, section_title, chunk_id, metadata, documents(filename)"
      )
      .in("metadata->>section_dafa", sectionNepalis)
      .limit(Math.min(500, sectionNepalis.length * 80));

    if (result.error) {
      if (result.error.message.includes("metadata")) return [] as ChunkRow[];
      throw new Error(result.error.message);
    }
    return (result.data ?? []) as unknown as ChunkRow[];
  }, `metadata sections [${sectionNums.join(",")}]`);

  if (data.length === 0) return [];

  const scoped = data
    .map((row) => {
      const doc = row.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      return { row, filename: filename ?? "unknown" };
    })
    .filter(({ filename }) => filenameMatchesAnyBookScope(filename, bookScope));

  return dedupeIndexedChunks(scoped.map(({ row }) => row))
    .map((row) => {
      const filename =
        scoped.find((item) => item.row.id === row.id)?.filename ??
        scoped.find((item) => item.row.chunk_id === row.chunk_id)?.filename ??
        "unknown";
      return {
        row,
        filename,
        order: chunkTypeOrder(row.metadata),
        sectionKey: String(row.metadata?.section_dafa ?? ""),
      };
    })
    .sort((a, b) => {
      const sectionCmp = a.sectionKey.localeCompare(b.sectionKey, "ne");
      if (sectionCmp !== 0) return sectionCmp;
      return a.order - b.order;
    })
    .map(({ row, filename }) =>
      enrichChunk({
        id: row.id,
        content: row.content,
        filename,
        page_number: row.page_number,
        section_label: row.section_label ?? null,
        chapter: row.chapter ?? null,
        section_title: row.section_title ?? null,
        metadata: row.metadata ?? null,
        similarity: 1,
      })
    );
}

async function retrieveBySectionMetadata(
  sectionDafa: string,
  bookScope: ParsedBookScope = "auto"
): Promise<MatchedChunk[]> {
  return retrieveSectionsByMetadataBatch([sectionDafa], bookScope);
}

async function retrieveByMetadataRef(
  ref: StructuredLegalRef,
  bookScope: BookScope = "auto"
): Promise<MatchedChunk[]> {
  if (!ref.sectionDafa) return [];

  const supabase = getSupabaseAdmin();
  const sectionNepali = toNepaliNumberDisplay(ref.sectionDafa);

  type ChunkRow = {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    section_title?: string | null;
    chunk_id?: string | null;
    metadata?: Record<string, unknown> | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  let dbQuery = supabase
    .from("chunks")
    .select(
      "id, content, page_number, section_label, chapter, section_title, chunk_id, metadata, documents(filename)"
    )
    .eq("metadata->>section_dafa", sectionNepali);

  if (ref.upadafa) {
    dbQuery = dbQuery.eq(
      "metadata->>subsection_upadafa",
      toNepaliNumberDisplay(ref.upadafa)
    );
  }

  if (ref.khanda) {
    const kh = ref.khanda.replace(/[()]/g, "").trim();
    const devanagariKhanda = CLAUSE_ROMAN[kh]
      ? kh
      : Object.entries(CLAUSE_ROMAN).find(
          ([, roman]) => roman === kh.toLowerCase()
        )?.[0];
    if (devanagariKhanda) {
      dbQuery = dbQuery.eq("metadata->>clause_khanda", devanagariKhanda);
    }
  } else if (ref.upadafa) {
    dbQuery = dbQuery.is("metadata->>clause_khanda", null);
  }

  const { data, error } = await dbQuery.limit(10);

  if (error) {
    if (error.message.includes("metadata")) return [];
    throw new Error(`Metadata retrieval failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ChunkRow[];
  return rows
    .map((row) => {
      const doc = row.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      return enrichChunk({
        id: row.id,
        content: row.content,
        filename: filename ?? "unknown",
        page_number: row.page_number,
        section_label: row.section_label ?? null,
        chapter: row.chapter ?? null,
        section_title: row.section_title ?? null,
        metadata: row.metadata ?? null,
        similarity: 1,
      });
    })
    .filter((chunk) => filenameMatchesScope(chunk.filename, bookScope));
}

/** Metadata-first lookup for quote mode (chunk_id, then metadata JSON fields). */
export async function retrieveByStructuredRef(
  ref: StructuredLegalRef,
  bookScope: BookScope = "auto"
): Promise<MatchedChunk[]> {
  // Khanda-only under a दफा (no उपदफा in query) — load full section to resolve homonyms
  if (ref.sectionDafa && ref.khanda && !ref.upadafa) {
    const full = await retrieveBySectionMetadata(ref.sectionDafa, bookScope);
    if (full.length > 0) return hydrateLinkedProvisionChunks(full, bookScope);
    const byMeta = await retrieveByMetadataRef(ref, bookScope);
    if (byMeta.length > 0) return hydrateLinkedProvisionChunks(byMeta, bookScope);
  }

  if (ref.chunkId) {
    const byId = await retrieveByChunkId(ref.chunkId, bookScope);
    if (byId.length > 0) return hydrateLinkedProvisionChunks(byId, bookScope);
  }

  if (ref.sectionDafa && (ref.upadafa || ref.khanda)) {
    const byMeta = await retrieveByMetadataRef(ref, bookScope);
    if (byMeta.length > 0) return hydrateLinkedProvisionChunks(byMeta, bookScope);
  }

  if (ref.sectionDafa && !ref.upadafa && !ref.khanda) {
    const bySection = await retrieveBySectionMetadata(ref.sectionDafa, bookScope);
    if (bySection.length > 0) return hydrateLinkedProvisionChunks(bySection, bookScope);

    const dafaId = buildDafaChunkId(ref.sectionDafa, null, null);
    const byDafa = await retrieveByChunkId(dafaId, bookScope);
    if (byDafa.length > 0) return hydrateLinkedProvisionChunks(byDafa, bookScope);
  }

  if (ref.chunkId) {
    return hydrateLinkedProvisionChunks(
      await retrieveByChunkId(ref.chunkId, bookScope),
      bookScope
    );
  }

  return [];
}

export type ProvisionTitleMatch = {
  kind: "dafa" | "chapter";
  chunks: MatchedChunk[];
  score: number;
};

type TitleSearchRow = {
  id: string;
  content: string;
  page_number: number | null;
  section_label?: string | null;
  chapter?: string | null;
  section_title?: string | null;
  chunk_id?: string | null;
  metadata?: Record<string, unknown> | null;
  documents: { filename: string } | { filename: string }[] | null;
};

async function retrieveByChapterMetadata(
  chapter: string,
  bookScope: ParsedBookScope = "auto"
): Promise<MatchedChunk[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("chunks")
    .select(
      "id, content, page_number, section_label, chapter, section_title, chunk_id, metadata, documents(filename)"
    )
    .eq("chapter", chapter)
    .limit(500);

  if (error) {
    if (error.message.includes("chapter")) return [];
    throw new Error(`Chapter metadata retrieval failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as TitleSearchRow[];
  return rows
    .map((row) => {
      const doc = row.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      return {
        row,
        filename: filename ?? "unknown",
        order: chunkTypeOrder(row.metadata),
      };
    })
    .filter(({ filename }) => filenameMatchesAnyBookScope(filename, bookScope))
    .sort((a, b) => {
      const dafaA = toArabicDigits(
        String(a.row.metadata?.section_dafa ?? "0")
      );
      const dafaB = toArabicDigits(
        String(b.row.metadata?.section_dafa ?? "0")
      );
      const dafaOrder = Number(dafaA) - Number(dafaB);
      if (dafaOrder !== 0) return dafaOrder;
      return a.order - b.order;
    })
    .map(({ row, filename }) =>
      enrichChunk({
        id: row.id,
        content: row.content,
        filename,
        page_number: row.page_number,
        section_label: row.section_label ?? null,
        chapter: row.chapter ?? null,
        section_title: row.section_title ?? null,
        similarity: 1,
      })
    );
}

/** Metadata lookup by दफा / परिच्छेद name (title search). */
export async function retrieveByProvisionTitle(
  query: string,
  bookScope: ParsedBookScope = "auto"
): Promise<ProvisionTitleMatch | null> {
  const candidates = mergeProvisionTitleSearchCandidates(query, []);
  if (candidates.length === 0) {
    if (!isProvisionTitleQuery(query)) return null;
    return retrieveByProvisionTitleCandidates(
      [expandProvisionTitleQuery(query)],
      bookScope
    );
  }
  return retrieveByProvisionTitleCandidates(candidates, bookScope);
}

async function fetchTitleSearchRows(
  anchors: string[],
  bookScope: ParsedBookScope
): Promise<TitleSearchRow[]> {
  const supabase = getSupabaseAdmin();
  const seen = new Set<string>();
  const allRows: TitleSearchRow[] = [];
  const scopedIds = targetBookIds(bookScope);

  for (const anchor of anchors) {
    const pattern = `%${anchor.replace(/[%_]/g, "")}%`;
    try {
      const rows = await withDbRetry(async () => {
        let query = supabase
          .from("chunks")
          .select(
            "id, content, page_number, section_label, chapter, section_title, chunk_id, metadata, documents!inner(filename, indexing_rule_id)"
          )
          .or(`section_title.ilike.${pattern},chapter.ilike.${pattern}`)
          .limit(250);
        if (scopedIds) {
          query = query.in("documents.indexing_rule_id", scopedIds);
        }
        const result = await query;
        if (result.error) {
          if (
            result.error.message.includes("section_title") ||
            result.error.message.includes("chapter") ||
            result.error.message.includes("indexing_rule_id")
          ) {
            return [] as TitleSearchRow[];
          }
          throw new Error(result.error.message);
        }
        return (result.data ?? []) as unknown as TitleSearchRow[];
      }, `provision title "${anchor.slice(0, 40)}"`);

      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        allRows.push(row);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("section_title") || msg.includes("chapter")) continue;
      throw new Error(`Provision title retrieval failed: ${msg}`);
    }
  }

  return allRows.filter((row) => {
    const doc = row.documents;
    const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
    return filenameMatchesAnyBookScope(filename ?? "", bookScope);
  });
}

function bestTitleScoreForCandidates(
  candidates: string[],
  target: string
): number {
  let best = 0;
  for (const candidate of candidates) {
    const expanded = expandProvisionTitleQuery(candidate);
    best = Math.max(best, scoreProvisionTitleMatch(expanded, target));
  }
  return best;
}

/** Score multiple title phrases; return best दफा / परिच्छेद match. */
export async function retrieveByProvisionTitleCandidates(
  candidates: string[],
  bookScope: ParsedBookScope = "auto"
): Promise<ProvisionTitleMatch | null> {
  const expanded = [
    ...new Set(
      candidates
        .map((c) => expandProvisionTitleQuery(c.trim()))
        .filter((c) => c.length >= 3)
    ),
  ].slice(0, 6);
  if (expanded.length === 0) return null;

  const anchors = pickTitleSearchAnchors(expanded);
  if (anchors.length === 0) return null;

  const rows = await fetchTitleSearchRows(anchors, bookScope);
  if (rows.length === 0) return null;

  const dafaScores = new Map<string, { score: number; title: string; filename: string }>();
  const chapterScores = new Map<string, number>();

  for (const row of rows) {
    const doc = row.documents;
    const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
    if (!filename) continue;

    const dafa = String(row.metadata?.section_dafa ?? "").trim();
    const sectionTitle = row.section_title?.trim();
    if (dafa && sectionTitle) {
      const score = bestTitleScoreForCandidates(expanded, sectionTitle);
      const key = `${filename}|${dafa}`;
      const existing = dafaScores.get(key);
      if (!existing || score > existing.score) {
        dafaScores.set(key, { score, title: sectionTitle, filename });
      }
    }

    const chapter = row.chapter?.trim();
    if (chapter) {
      const displayName = extractChapterDisplayName(chapter);
      const score = Math.max(
        bestTitleScoreForCandidates(expanded, displayName),
        bestTitleScoreForCandidates(expanded, chapter) * 0.95
      );
      chapterScores.set(chapter, Math.max(chapterScores.get(chapter) ?? 0, score));
    }
  }

  let bestDafa: { dafa: string; score: number; filename: string } | null = null;
  for (const [key, { score, filename }] of dafaScores) {
    const dafa = key.split("|").pop() ?? "";
    if (!bestDafa || score > bestDafa.score) {
      bestDafa = { dafa, score, filename };
    }
  }

  let bestChapter: { chapter: string; score: number } | null = null;
  for (const [chapter, score] of chapterScores) {
    if (!bestChapter || score > bestChapter.score) {
      bestChapter = { chapter, score };
    }
  }

  const dafaScore = bestDafa?.score ?? 0;
  const chapterScore = bestChapter?.score ?? 0;

  if (dafaScore < MIN_PROVISION_TITLE_SCORE && chapterScore < MIN_PROVISION_TITLE_SCORE) {
    return null;
  }

  const chapterDisplay = bestChapter
    ? extractChapterDisplayName(bestChapter.chapter)
    : "";
  const chapterNameScore = bestChapter
    ? bestTitleScoreForCandidates(expanded, chapterDisplay)
    : 0;

  const preferChapter =
    bestChapter &&
    chapterScore >= MIN_PROVISION_TITLE_SCORE &&
    dafaScore < 0.88 &&
    (chapterScore > dafaScore * 1.02 || chapterNameScore >= dafaScore);

  if (preferChapter && bestChapter) {
    const chunks = await retrieveByChapterMetadata(bestChapter.chapter, bookScope);
    if (chunks.length > 0) {
      return { kind: "chapter", chunks, score: chapterScore };
    }
  }

  if (bestDafa && dafaScore >= MIN_PROVISION_TITLE_SCORE) {
    const sectionArabic = toArabicDigits(bestDafa.dafa);
    const chunks = (await retrieveBySectionMetadata(sectionArabic, bookScope)).filter(
      (chunk) => chunk.filename === bestDafa!.filename
    );
    if (chunks.length > 0) {
      return { kind: "dafa", chunks, score: dafaScore };
    }
  }

  if (bestChapter && chapterScore >= MIN_PROVISION_TITLE_SCORE) {
    const chunks = await retrieveByChapterMetadata(bestChapter.chapter, bookScope);
    if (chunks.length > 0) {
      return { kind: "chapter", chunks, score: chapterScore };
    }
  }

  return null;
}

async function retrieveBySectionNumber(
  sectionNum: string,
  matchCount = TOP_K,
  query = "",
  bookScope: ParsedBookScope = "auto"
): Promise<MatchedChunk[]> {
  const legacyScope = primaryBookId(bookScope);
  const metadata = await retrieveSectionsByMetadataBatch([sectionNum], bookScope);
  if (metadata.length > 0) {
    return metadata.slice(0, matchCount);
  }

  const supabase = getSupabaseAdmin();
  const sectionNepali = toNepaliNumberDisplay(sectionNum);
  const filters = [
    `section_label.eq.${sectionNum}`,
    `section_label.like.${sectionNum}.%`,
    `content.ilike.%दफा ${sectionNum} —%`,
    `content.ilike.%दफा : ${sectionNepali}%`,
    `content.ilike.%\\n${sectionNum}. %`,
    `content.ilike.%| दफा ${sectionNum} —%`,
  ].join(",");

  type ChunkRow = {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  const data = await withDbRetry(async () => {
    const withSections = await supabase
      .from("chunks")
      .select("id, content, page_number, section_label, chapter, documents(filename)")
      .or(filters)
      .limit(40);

    const fallback = withSections.error?.message.includes("section_label")
      ? await supabase
          .from("chunks")
          .select("id, content, page_number, documents(filename)")
          .or(filters)
          .limit(40)
      : null;

    const result = fallback ?? withSections;
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []) as unknown as ChunkRow[];
  }, `section ilike ${sectionNum}`);

  const ranked = rankSectionChunks(
    data.map((row) => {
      const r = row;
      const doc = r.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      const label =
        r.section_label ?? parseSectionLabelFromContent(r.content);
      const isExact =
        label === sectionNum || label?.startsWith(`${sectionNum}.`);
      return enrichChunk({
        id: r.id,
        content: r.content,
        filename: filename ?? "unknown",
        page_number: r.page_number,
        section_label: label,
        chapter: r.chapter ?? null,
        similarity: isExact ? 1 : 0.5,
      });
    }),
    sectionNum
  )
    .filter((row) => {
      const base = row.section_label?.split(".")[0];
      return base === sectionNum;
    })
    .map(({ quality, ...chunk }) => ({
      ...chunk,
      similarity: chunk.similarity + quality * 0.05,
    }))
    .sort((a, b) => {
      const qa = sectionChunkQuality(a.content, sectionNum, a.page_number, a.section_label);
      const qb = sectionChunkQuality(b.content, sectionNum, b.page_number, b.section_label);
      if (qb !== qa) return qb - qa;
      const pageA = a.page_number ?? 9999;
      const pageB = b.page_number ?? 9999;
      if (pageA !== pageB) return pageA - pageB;
      return b.similarity - a.similarity;
    });

  const bookFilter = resolveBookFilter(bookScope, query);
  let pool = ranked;
  if (targetBookIds(bookScope)) {
    const bookMatches = ranked.filter((c) =>
      filenameMatchesAnyBookScope(c.filename, bookScope)
    );
    if (bookMatches.length > 0) {
      pool = bookMatches;
    } else {
      const byMeta = await retrieveBySectionMetadata(sectionNum, bookScope);
      if (byMeta.length > 0) return byMeta;
      return [];
    }
  } else if (legacyScope && legacyScope !== "auto") {
    const bookMatches = ranked.filter((c) =>
      filenameMatchesScope(c.filename, legacyScope)
    );
    if (bookMatches.length > 0) {
      pool = bookMatches;
    } else {
      const byMeta = await retrieveBySectionMetadata(sectionNum, legacyScope);
      if (byMeta.length > 0) return byMeta;
      return [];
    }
  } else if (bookFilter) {
    const bookMatches = ranked.filter((c) => bookFilter.test(c.filename));
    if (bookMatches.length > 0) {
      pool = bookMatches;
    }
  }

  const sliced = pool.slice(0, matchCount);

  return fetchAllSectionParts(
    sectionNum,
    sliced.length > 0 ? sliced : pool,
    bookScope
  );
}

async function fetchAllSectionParts(
  sectionNum: string,
  seeds: MatchedChunk[],
  bookScope: ParsedBookScope
): Promise<MatchedChunk[]> {
  if (seeds.length === 0) return seeds;

  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const supabase = getSupabaseAdmin();
  const seen = new Set(seeds.map((c) => c.id));
  const expanded = [...seeds];

  const targetFilenames = [
    ...new Set(seeds.map((c) => c.filename)),
  ].slice(0, scopedIds || legacyScope !== "auto" ? (scopedIds?.length ?? 1) : 2);

  type ChunkRow = {
    id: string;
    content: string;
    page_number: number | null;
    section_label?: string | null;
    chapter?: string | null;
    documents: { filename: string } | { filename: string }[] | null;
  };

  for (const filename of targetFilenames) {
    const withSections = await supabase
      .from("chunks")
      .select("id, content, page_number, section_label, chapter, documents(filename)")
      .or(
        `section_label.eq.${sectionNum},section_label.like.${sectionNum}.%`
      )
      .limit(40);

    if (withSections.error) continue;

    for (const row of withSections.data ?? []) {
      const r = row as unknown as ChunkRow;
      if (seen.has(r.id)) continue;

      const doc = r.documents;
      const rowFilename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      if (rowFilename !== filename) continue;

      const body = r.content.split("\n").slice(1).join("\n");
      const quality = sectionChunkQuality(
        r.content,
        sectionNum,
        r.page_number,
        r.section_label
      );
      if (quality < 0 || isFormOrJunkSection(body)) continue;

      expanded.push(
        enrichChunk({
          id: r.id,
          content: r.content,
          filename: rowFilename ?? filename,
          page_number: r.page_number ?? null,
          section_label: r.section_label ?? null,
          chapter: r.chapter ?? null,
          similarity: 1,
        })
      );
      seen.add(r.id);
    }
  }

  return dedupeSectionChunks(expanded)
    .filter((c) => {
      const body = c.content.split("\n").slice(1).join("\n");
      return (
        sectionChunkQuality(
          c.content,
          sectionNum,
          c.page_number,
          c.section_label
        ) > -3 && !isFormOrJunkSection(body)
      );
    })
    .sort((a, b) => compareSectionParts(a, b, sectionNum))
    .slice(0, SECTION_TOP_K);
}

async function fetchSiblingChunks(
  chunks: MatchedChunk[]
): Promise<MatchedChunk[]> {
  if (chunks.length === 0) return chunks;

  const supabase = getSupabaseAdmin();
  const seen = new Set(chunks.map((c) => c.id));
  const expanded = [...chunks];

  for (const chunk of chunks.slice(0, 3)) {
    const baseSection = chunk.section_label?.split(".")[0];
    if (!baseSection) continue;
    if (
      sectionChunkQuality(
        chunk.content,
        baseSection,
        chunk.page_number,
        chunk.section_label
      ) < 0
    ) {
      continue;
    }
    const sectionLabel = chunk.section_label;
    if (!sectionLabel) continue;

    let data: {
      id: string;
      content: string;
      page_number: number | null;
      section_label?: string | null;
      chapter?: string | null;
      documents: { filename: string } | { filename: string }[] | null;
    }[] | null = null;

    const withSections = await supabase
      .from("chunks")
      .select("id, content, page_number, section_label, chapter, documents(filename)")
      .or(
        `section_label.eq.${baseSection},section_label.like.${baseSection}.%`
      )
      .limit(12);

    if (!withSections.error) {
      data = withSections.data;
    } else {
      const byContent = await supabase
        .from("chunks")
        .select("id, content, page_number, documents(filename)")
        .or(
          `section_label.eq.${baseSection},section_label.like.${baseSection}.%,content.ilike.%दफा ${baseSection} —%,content.ilike.%\\n${baseSection}. %`
        )
        .limit(12);
      data = byContent.data;
    }

    for (const row of data ?? []) {
      if (seen.has(row.id)) continue;
      const body = row.content.split("\n").slice(1).join("\n");
      const quality = sectionChunkQuality(row.content, baseSection, row.page_number, row.section_label);
      if (quality < 2 || isFormOrJunkSection(body)) continue;
      const doc = row.documents as { filename: string } | { filename: string }[] | null;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      expanded.push(
        enrichChunk({
          id: row.id,
          content: row.content,
          filename: filename ?? "unknown",
          page_number: row.page_number ?? null,
          section_label: row.section_label ?? null,
          chapter: row.chapter ?? null,
          similarity: chunk.similarity * 0.9,
        })
      );
      seen.add(row.id);
    }
  }

  return expanded
    .filter((c) => {
      const body = c.content.split("\n").slice(1).join("\n");
      return sectionChunkQuality(c.content, c.section_label ?? undefined, c.page_number, c.section_label) > -3
        && !isFormOrJunkSection(body);
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);
}

type FtsChunkRow = {
  id: string;
  content: string;
  filename: string;
  page_number: number | null;
  section_label: string | null;
  chapter: string | null;
  similarity: number;
};

let ftsSearchAvailable: boolean | null = null;

function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\s\w\u0900-\u097F]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchChunksFts(
  query: string,
  matchCount: number,
  searchMode: "plain" | "or"
): Promise<FtsChunkRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("search_chunks_fts", {
    search_query: query,
    match_count: matchCount,
    search_mode: searchMode,
  });

  if (error) {
    if (
      error.message.includes("search_chunks_fts") ||
      error.message.includes("search_vector")
    ) {
      ftsSearchAvailable = false;
      return [];
    }
    throw new Error(`FTS retrieval failed: ${error.message}`);
  }

  ftsSearchAvailable = true;
  return (data ?? []) as FtsChunkRow[];
}

function mapFtsRowsToChunks(rows: FtsChunkRow[], matchCount: number): MatchedChunk[] {
  return rows
    .slice(0, matchCount)
    .map((row) =>
      enrichChunk({
        id: row.id,
        content: row.content,
        filename: row.filename ?? "unknown",
        page_number: row.page_number ?? null,
        section_label:
          row.section_label ?? parseSectionLabelFromContent(row.content),
        chapter: row.chapter ?? parseChapterFromContent(row.content),
        similarity: row.similarity,
      })
    );
}

async function retrieveByKeywordLegacy(
  query: string,
  matchCount: number
): Promise<MatchedChunk[]> {
  const supabase = getSupabaseAdmin();
  const words = queryWords(query);

  const contentFilters = words
    .map((word) => `content.ilike.%${word.replace(/[%_]/g, "")}%`)
    .join(",");

  const sectionFilters = words
    .map((word) => `section_label.ilike.%${word.replace(/[%_]/g, "")}%`)
    .join(",");

  let orFilter = contentFilters;
  let select =
    "id, content, page_number, section_label, chapter, documents(filename)";

  let result = await supabase
    .from("chunks")
    .select(select)
    .or(`${orFilter},${sectionFilters}`)
    .limit(120);

  if (result.error?.message.includes("section_label")) {
    select = "id, content, page_number, documents(filename)";
    result = await supabase
      .from("chunks")
      .select(select)
      .or(orFilter)
      .limit(120);
  }

  if (result.error) {
    throw new Error(`Keyword retrieval failed: ${result.error.message}`);
  }

  return (result.data ?? [])
    .map((row) => {
      const r = row as unknown as {
        id: string;
        content: string;
        page_number: number | null;
        section_label?: string | null;
        chapter?: string | null;
        documents: { filename: string } | { filename: string }[] | null;
      };
      const doc = r.documents;
      const filename = Array.isArray(doc) ? doc[0]?.filename : doc?.filename;
      const sectionLabel =
        r.section_label ?? parseSectionLabelFromContent(r.content);
      const wordScore = scoreChunk(r.content, sectionLabel, words);
      return enrichChunk({
        id: r.id,
        content: r.content,
        filename: filename ?? "unknown",
        page_number: r.page_number ?? null,
        section_label: sectionLabel,
        chapter: r.chapter ?? parseChapterFromContent(r.content),
        similarity: wordScore / words.length,
      });
    })
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

export async function retrieveByKeyword(
  query: string,
  matchCount = TOP_K
): Promise<MatchedChunk[]> {
  const cleaned = sanitizeFtsQuery(query);
  if (!cleaned) return [];

  if (ftsSearchAvailable !== false) {
    const fetchLimit = Math.min(Math.max(matchCount * 3, matchCount), 120);
    let rows = await searchChunksFts(cleaned, fetchLimit, "plain");
    if (rows.length === 0) {
      rows = await searchChunksFts(cleaned, fetchLimit, "or");
    }

    if (ftsSearchAvailable) {
      const ranked = mapFtsRowsToChunks(rows, matchCount);
      return fetchSiblingChunks(ranked);
    }
  }

  const ranked = await retrieveByKeywordLegacy(query, matchCount);
  return fetchSiblingChunks(ranked);
}

/** When vector/keyword search misses within a scoped book, pin known topic दफा. */
async function retrieveTopicSectionFallback(
  query: string,
  bookScope: BookScope,
  matchCount: number
): Promise<MatchedChunk[]> {
  const lookups = supplementalSectionLookups(query).filter(
    (l) => l.scope === bookScope
  );
  const merged: MatchedChunk[] = [];
  for (const { section, scope } of lookups) {
    const sectionChunks = await retrieveBySectionNumber(
      section,
      matchCount,
      query,
      scope
    );
    merged.push(...sectionChunks);
  }
  if (merged.length === 0) return [];
  return dedupeChunksByBestScore(merged).slice(0, matchCount);
}

export async function retrieveByVector(
  query: string,
  matchCount = TOP_K,
  embedText?: string
): Promise<MatchedChunk[]> {
  const embedding = await embedQuery(embedText ?? query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Vector retrieval failed: ${error.message}`);
  }

  const chunks = ((data ?? []) as MatchedChunk[]).map((chunk) =>
    enrichChunk({ ...chunk, filename: chunk.filename, similarity: chunk.similarity })
  );
  return fetchSiblingChunks(chunks);
}

export async function retrieveChunks(
  query: string,
  matchCount = TOP_K,
  bookScope: ParsedBookScope = "auto",
  embedText?: string
): Promise<{ chunks: MatchedChunk[]; mode: "vector" | "keyword" }> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const scopeFilter = (chunks: MatchedChunk[]) =>
    scopedIds
      ? chunks.filter((c) => filenameMatchesAnyBookScope(c.filename, bookScope))
      : chunks;

  const chunkId = extractChunkIdFromQuery(query);
  if (chunkId) {
    const idChunks = scopeFilter(
      await retrieveByChunkId(chunkId, legacyScope)
    );
    if (idChunks.length > 0) {
      return { chunks: idChunks, mode: "keyword" };
    }
  }

  const sectionNum = extractSectionFromQuery(query);
  if (sectionNum) {
    const sectionChunks = scopeFilter(
      await retrieveBySectionNumber(
        sectionNum,
        Math.max(matchCount, SECTION_TOP_K),
        query,
        legacyScope
      )
    );
    if (sectionChunks.length > 0) {
      return { chunks: sectionChunks, mode: "keyword" };
    }
  }

  const titleMatch = await retrieveByProvisionTitle(query, bookScope);
  if (titleMatch && titleMatch.chunks.length > 0) {
    const limit =
      titleMatch.kind === "chapter"
        ? titleMatch.chunks.length
        : Math.max(matchCount, SECTION_TOP_K);
    return {
      chunks: titleMatch.chunks.slice(0, limit),
      mode: "keyword",
    };
  }

  if (scopedIds) {
    const candidateK = Math.min(
      matchCount * getHybridCandidateMultiplier(),
      48
    );
    const crossChunks = await retrieveByCrossBookSearch(
      query,
      scopedIds,
      candidateK,
      embedText
    );
    if (crossChunks.length > 0) {
      return {
        chunks: crossChunks.slice(0, matchCount),
        mode: "vector",
      };
    }
    const fallback = await retrieveTopicSectionFallback(
      query,
      legacyScope,
      matchCount
    );
    return { chunks: scopeFilter(fallback), mode: "keyword" };
  }

  const mode = getRetrievalMode();
  const supabase = getSupabaseAdmin();

  const { count: embeddedCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  let chunks: MatchedChunk[];
  let retrievalMode: "vector" | "keyword" = "keyword";

  if ((embeddedCount ?? 0) === 0) {
    chunks = await retrieveByKeyword(query, matchCount);
  } else if (mode === "keyword") {
    chunks = await retrieveByKeyword(query, matchCount);
  } else {
    try {
      const multiplier = getHybridCandidateMultiplier();
      const candidateK = Math.min(matchCount * multiplier, 48);
      const [vectorChunks, keywordChunks] = await Promise.all([
        retrieveByVector(query, candidateK, embedText),
        retrieveByKeyword(query, candidateK),
      ]);
      const [vectorWeight, keywordWeight] = getHybridFusionWeights();
      const fused = fuseRankedListsRRF([vectorChunks, keywordChunks], {
        listNames: ["vector", "keyword"],
        weights: [vectorWeight, keywordWeight],
      }).slice(0, matchCount);

      if (fused.length > 0) {
        chunks = fused;
        retrievalMode = vectorChunks.length > 0 ? "vector" : "keyword";
        console.log(
          "[HandyLaw hybrid RRF]",
          JSON.stringify(
            {
              query: query.slice(0, 80),
              candidateK,
              vectorHits: vectorChunks.length,
              keywordHits: keywordChunks.length,
              fused: fused.map((c) => ({
                id: c.id,
                dafa: c.section_label,
                vectorRank: c.fusion?.vectorRank ?? null,
                keywordRank: c.fusion?.keywordRank ?? null,
                rrfScore: Number((c.fusion?.rrfScore ?? c.similarity).toFixed(4)),
              })),
            },
            null,
            2
          )
        );
      } else {
        chunks = await retrieveByKeyword(query, matchCount);
      }
    } catch (error) {
      if (mode === "auto") {
        console.warn("Vector retrieval failed, falling back to keyword search");
        chunks = await retrieveByKeyword(query, matchCount);
      } else {
        throw error;
      }
    }
  }

  const bookFilter = resolveBookFilter(bookScope, query);
  if (legacyScope !== "auto" && !scopedIds) {
    const filtered = chunks.filter((c) =>
      filenameMatchesScope(c.filename, legacyScope)
    );
    if (filtered.length > 0) {
      return { chunks: filtered, mode: retrievalMode };
    }
    const fallback = await retrieveTopicSectionFallback(
      query,
      legacyScope,
      matchCount
    );
    if (fallback.length > 0) {
      return { chunks: fallback, mode: "keyword" };
    }
    return { chunks: [], mode: "keyword" };
  }
  if (bookFilter) {
    const filtered = chunks.filter((c) => bookFilter.test(c.filename));
    if (filtered.length > 0) {
      return { chunks: filtered, mode: retrievalMode };
    }
  }

  return { chunks, mode: retrievalMode };
}

/**
 * Advocate hybrid RRF: vector search on the question, keyword FTS on legal terms.
 */
export async function retrieveChunksSplitHybrid(
  vectorQuery: string,
  keywordQuery: string,
  matchCount = TOP_K,
  bookScope: ParsedBookScope = "auto",
  embedText?: string
): Promise<{ chunks: MatchedChunk[]; mode: "vector" | "keyword" }> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const scopeFilter = (chunks: MatchedChunk[]) =>
    scopedIds
      ? chunks.filter((c) => filenameMatchesAnyBookScope(c.filename, bookScope))
      : chunks;

  const vec = vectorQuery.trim();
  const kw = (keywordQuery.trim() || vec).trim();
  if (!vec && !kw) return { chunks: [], mode: "keyword" };

  const mode = getRetrievalMode();
  const supabase = getSupabaseAdmin();
  const { count: embeddedCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  if ((embeddedCount ?? 0) === 0 || mode === "keyword") {
    return {
      chunks: scopeFilter(await retrieveByKeyword(kw, matchCount)),
      mode: "keyword",
    };
  }

  const multiplier = getHybridCandidateMultiplier();
  const candidateK = Math.min(matchCount * multiplier, 48);

  try {
    let vectorChunks: MatchedChunk[];
    let keywordChunks: MatchedChunk[];

    if (scopedIds) {
      vectorChunks = await retrieveByCrossBookSearch(
        vec,
        scopedIds,
        candidateK,
        embedText
      );
      keywordChunks = scopeFilter(await retrieveByKeyword(kw, candidateK));
    } else {
      [vectorChunks, keywordChunks] = await Promise.all([
        retrieveByVector(vec, candidateK, embedText),
        retrieveByKeyword(kw, candidateK),
      ]);
    }

    const [vectorWeight, keywordWeight] = getHybridFusionWeights();
    const fused = fuseRankedListsRRF([vectorChunks, keywordChunks], {
      listNames: ["vector", "keyword"],
      weights: [vectorWeight, keywordWeight],
    }).slice(0, matchCount);

    if (fused.length > 0) {
      console.log(
        "[HandyLaw advocate split RRF]",
        JSON.stringify({
          vectorQuery: vec.slice(0, 80),
          keywordQuery: kw.slice(0, 80),
          candidateK,
          vectorHits: vectorChunks.length,
          keywordHits: keywordChunks.length,
          fused: fused.slice(0, 8).map((c) => ({
            id: c.id,
            dafa: c.section_label,
            vectorRank: c.fusion?.vectorRank ?? null,
            keywordRank: c.fusion?.keywordRank ?? null,
            rrfScore: Number((c.fusion?.rrfScore ?? c.similarity).toFixed(4)),
          })),
        })
      );
      const chunks = scopeFilter(fused).slice(0, matchCount);
      if (legacyScope !== "auto" && !scopedIds) {
        const filtered = chunks.filter((c) =>
          filenameMatchesScope(c.filename, legacyScope)
        );
        if (filtered.length > 0) {
          return {
            chunks: filtered,
            mode: vectorChunks.length > 0 ? "vector" : "keyword",
          };
        }
      }
      return {
        chunks,
        mode: vectorChunks.length > 0 ? "vector" : "keyword",
      };
    }
  } catch (error) {
    if (mode !== "auto") throw error;
    console.warn("Split hybrid retrieval failed, falling back to keyword search");
  }

  const fallback = scopeFilter(await retrieveByKeyword(kw, matchCount));
  if (legacyScope !== "auto" && !scopedIds && fallback.length === 0) {
    const topicFallback = await retrieveTopicSectionFallback(
      kw,
      legacyScope,
      matchCount
    );
    if (topicFallback.length > 0) {
      return { chunks: topicFallback, mode: "keyword" };
    }
  }
  return { chunks: fallback, mode: "keyword" };
}

function dedupeChunksByBestScore(chunks: MatchedChunk[]): MatchedChunk[] {
  const byId = new Map<string, MatchedChunk>();
  for (const chunk of chunks) {
    const existing = byId.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      byId.set(chunk.id, chunk);
    }
  }
  return [...byId.values()].sort((a, b) => b.similarity - a.similarity);
}

/** Deterministic lookups that do not require LLM analysis — run in parallel with analyzeQuery. */
export async function retrieveDeterministicAdvocateSeeds(
  query: string,
  bookScope: ParsedBookScope
): Promise<MatchedChunk[]> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const tasks: Promise<MatchedChunk[]>[] = [];

  const chunkId = extractChunkIdFromQuery(query);
  if (chunkId) {
    tasks.push(retrieveByChunkId(chunkId, legacyScope));
  }

  const sectionNum = extractSectionFromQuery(query);
  if (sectionNum) {
    tasks.push(
      retrieveBySectionNumber(
        sectionNum,
        Math.max(SECTION_TOP_K, ADVOCATE_TOP_K),
        query,
        bookScope
      )
    );
  }

  const titleCandidates = topProvisionTitleCandidates(query);
  if (titleCandidates.length > 0) {
    tasks.push(
      retrieveByProvisionTitleCandidates(titleCandidates, bookScope).then((m) => {
        if (!m || m.score < MIN_PROVISION_TITLE_SCORE) return [];
        return m.chunks.map((c) => ({
          ...c,
          similarity: Math.max(c.similarity, 0.93),
        }));
      })
    );
  } else if (isProvisionTitleQuery(query)) {
    tasks.push(
      retrieveByProvisionTitle(query, bookScope).then((m) =>
        (m?.chunks ?? []).map((c) => ({
          ...c,
          similarity: Math.max(c.similarity, 0.93),
        }))
      )
    );
  }

  if (
    isJaheriRegistrationRefusalQuery(query) &&
    (!scopedIds || scopedIds.includes("criminal-procedure"))
  ) {
    tasks.push(retrieveBySectionNumber("5", 12, query, "criminal-procedure"));
  }

  const lookups = supplementalSectionLookups(query).filter((l) => {
    if (scopedIds) return scopedIds.includes(l.scope);
    return legacyScope === "auto" || l.scope === legacyScope;
  });
  for (const { section, scope } of lookups) {
    tasks.push(retrieveBySectionNumber(section, 12, query, scope));
  }

  if (tasks.length === 0) return [];

  const batches = await Promise.all(tasks);
  const merged = dedupeChunksByBestScore(
    batches.flat().map((c) => ({
      ...c,
      similarity: Math.max(c.similarity, 0.88),
    }))
  );

  if (merged.length > 0) {
    console.log(
      "[HandyLaw deterministic prefetch]",
      JSON.stringify({
        query: query.slice(0, 80),
        hits: merged.length,
        dafa: merged.slice(0, 5).map((c) => c.section_label),
      })
    );
  }

  return merged;
}

export async function retrieveChunksMulti(
  queries: string[],
  topK = ADVOCATE_TOP_K,
  bookScope: ParsedBookScope = "auto",
  originalQuestion?: string,
  preferredAct?: string,
  analysis?: QueryAnalysis
): Promise<{ chunks: MatchedChunk[]; mode: "vector" | "keyword" }> {
  const allQueryText = [...queries, originalQuestion ?? ""].join(" ");
  const supplemental = supplementalRetrievalQueries(allQueryText, bookScope);
  const sectionNums = supplementalSectionNumbers(allQueryText);
  const sectionLookups = supplementalSectionLookups(allQueryText);

  const uniqueQueries = [
    ...new Set(
      [...queries, ...supplemental, originalQuestion ?? ""]
        .map((q) => q.trim())
        .filter(Boolean)
    ),
  ];

  const perQueryK = Math.max(topK, 6);
  const merged: MatchedChunk[] = [];
  let dominantMode: "vector" | "keyword" = "keyword";

  // Always search using the user's bookScope (auto = all indexed books).
  for (const query of uniqueQueries) {
    const embedText = analysis
      ? buildAdvocateEmbedQuery(query, {
          preferredAct: analysis.preferredAct ?? preferredAct,
          intent: analysis.intent,
          legalIssues: analysis.legalIssues,
        })
      : preferredAct
        ? buildAdvocateEmbedQuery(query, { preferredAct })
        : undefined;
    const { chunks, mode } = await retrieveChunks(
      query,
      perQueryK,
      bookScope,
      embedText
    );
    if (mode === "vector") dominantMode = "vector";
    merged.push(...chunks);
  }

  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);

  // Act-specific section boost: additive, does not exclude other books.
  const sectionBoostScope =
    scopedIds
      ? null
      : legacyScope !== "auto"
        ? legacyScope
        : preferredActToBookScope(preferredAct) ??
          queryHintToBookScope(allQueryText);

  if (sectionLookups.length > 0) {
    for (const { section, scope } of sectionLookups) {
      if (scopedIds && !scopedIds.includes(scope)) continue;
      if (!scopedIds && legacyScope !== "auto" && scope !== legacyScope) {
        continue;
      }
      const sectionChunks = await retrieveBySectionNumber(
        section,
        12,
        allQueryText,
        scope
      );
      for (const chunk of sectionChunks) {
        merged.push({ ...chunk, similarity: Math.max(chunk.similarity, 0.9) });
      }
    }

    const titlePins: Array<{ query: string; scope: BookScope }> = [];
    if (/बालविवाह|बाल विवाह/i.test(allQueryText)) {
      titlePins.push({ query: "बाल विवाह गर्न नहुने", scope: "criminal-code" });
    }
    if (/विवाह.*उमेर|विवाह हुन सक्ने|विवाह गर्नका/i.test(allQueryText)) {
      titlePins.push({ query: "विवाह हुन सक्ने", scope: "civil-code" });
    }
    if (/false.*complaint|झुठ्ठा.*उजुर/i.test(allQueryText)) {
      titlePins.push({ query: "झुठ्ठा उजुरी दिन नहुने", scope: "criminal-code" });
    }
    for (const pin of titlePins) {
      if (scopedIds && !scopedIds.includes(pin.scope)) continue;
      if (!scopedIds && legacyScope !== "auto" && pin.scope !== legacyScope) {
        continue;
      }
      const titleMatch = await retrieveByProvisionTitle(pin.query, pin.scope);
      if (titleMatch?.chunks.length) {
        for (const chunk of titleMatch.chunks) {
          merged.push({ ...chunk, similarity: 0.95 });
        }
      }
    }
  } else if (sectionBoostScope && sectionNums.length > 0) {
    for (const sectionNum of sectionNums) {
      const sectionChunks = await retrieveBySectionNumber(
        sectionNum,
        12,
        allQueryText,
        sectionBoostScope
      );
      for (const chunk of sectionChunks) {
        merged.push({ ...chunk, similarity: Math.max(chunk.similarity, 0.85) });
      }
    }
  }

  let deduped = dedupeChunksByBestScore(merged);
  deduped = filterChunksToBookScope(deduped, bookScope);

  if (bookScope === "auto" && sectionBoostScope) {
    deduped = rerankWithActBoost(deduped, sectionBoostScope);
  }

  const pinned = deduped.filter((c) => c.similarity >= PINNED_SIMILARITY);
  const rest = deduped.filter((c) => c.similarity < PINNED_SIMILARITY);
  const budget = Math.max(topK, 16);
  deduped = [
    ...pinned,
    ...rest.slice(0, Math.max(0, budget - pinned.length)),
  ];

  console.log(
    "[HandyLaw retrieval]",
    JSON.stringify(
      {
        queries: uniqueQueries,
        topK,
        bookScope,
        sectionBoostScope: sectionBoostScope ?? null,
        sectionLookups,
        sectionNums,
        pinned: pinned.length,
        hits: deduped.map((c) => ({
          id: c.id,
          dafa: c.section_label,
          file: c.filename,
          sim: Number(c.similarity.toFixed(3)),
          ...(c.fusion
            ? {
                vectorRank: c.fusion.vectorRank ?? null,
                keywordRank: c.fusion.keywordRank ?? null,
                rrfScore: Number(c.fusion.rrfScore.toFixed(4)),
              }
            : {}),
        })),
      },
      null,
      2
    )
  );

  return { chunks: deduped, mode: dominantMode };
}

function bookScopeFromFilename(filename: string): BookScope | null {
  for (const book of LAW_BOOKS) {
    if (filenameMatchesScope(filename, book.id)) return book.id;
  }
  return null;
}

function sectionRootLabel(chunk: MatchedChunk): string {
  const label = chunk.section_label?.split(".")[0]?.trim();
  if (label) return toArabicDigits(label);
  const fromContent = parseSectionLabelFromContent(chunk.content);
  return fromContent ? toArabicDigits(fromContent) : "";
}

function dafaGroupKey(chunk: MatchedChunk): string {
  return `${chunk.filename}|${sectionRootLabel(chunk)}`;
}

function groupChunksByDafa(chunks: MatchedChunk[]): MatchedChunk[][] {
  const groups = new Map<string, MatchedChunk[]>();
  for (const chunk of chunks) {
    const key = dafaGroupKey(chunk);
    if (!key.endsWith("|")) {
      const list = groups.get(key) ?? [];
      list.push(chunk);
      groups.set(key, list);
    }
  }
  return [...groups.values()];
}

function scoreDafaGroupForQuery(
  group: MatchedChunk[],
  queryText: string
): number {
  const first = group[0];
  const title =
    parseSectionTitleFromContent(first.content) ??
    first.section_label ??
    "";
  const chapterName = first.chapter
    ? extractChapterDisplayName(first.chapter)
    : "";
  const bodySample = getProvisionBody(first.content).slice(0, 400);
  const titleScore = scoreProvisionTitleMatch(queryText, title);
  const chapterScore = chapterName
    ? scoreProvisionTitleMatch(queryText, chapterName) * 0.35
    : 0;
  const bodyScore = scoreProvisionTitleMatch(queryText, bodySample) * 0.45;
  return Math.max(titleScore, chapterScore + bodyScore);
}

export async function resolveChapterStoredValue(
  hint: ChapterHint,
  bookScope: BookScope
): Promise<string | null> {
  const scope = normalizeActToBookScope(hint.act);
  if (!scope) return null;
  if (bookScope !== "auto" && scope !== bookScope) return null;

  const chapterNum = toNepaliNumberDisplay(toArabicDigits(hint.chapter));
  const nameFrag = hint.name?.trim().replace(/[%_]/g, "") ?? "";
  const supabase = getSupabaseAdmin();
  const docIds = await getDocumentIdsForBookScope(scope);
  if (docIds.length === 0) return null;

  const { data, error } = await supabase
    .from("chunks")
    .select("chapter")
    .in("document_id", docIds)
    .ilike("chapter", `%परिच्छेद ${chapterNum}%`)
    .limit(20);

  if (error || !data?.length) return null;

  for (const row of data as Array<{ chapter: string | null }>) {
    const ch = row.chapter?.trim();
    if (!ch) continue;
    if (nameFrag && !ch.includes(nameFrag)) continue;
    return ch;
  }
  return null;
}

async function resolveChapterTargets(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope
): Promise<Map<string, { chapter: string; scope: BookScope }>> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const targets = new Map<string, { chapter: string; scope: BookScope }>();
  const hints = analysis.chapterHints.filter((hint) => {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) return false;
    if (scopedIds && !scopedIds.includes(scope)) return false;
    if (!scopedIds && legacyScope !== "auto" && scope !== legacyScope) return false;
    return true;
  });

  const resolved = await Promise.all(
    hints.map(async (hint) => {
      const scope = normalizeActToBookScope(hint.act)!;
      const chapter = await resolveChapterStoredValue(hint, scope);
      return chapter ? { key: `${scope}|${chapter}`, chapter, scope } : null;
    })
  );

  for (const item of resolved) {
    if (item) targets.set(item.key, { chapter: item.chapter, scope: item.scope });
  }

  return targets;
}

function filterChunksToChapterScope(
  chunks: MatchedChunk[],
  allowedChapters: Set<string>,
  pinnedKeys: Set<string>
): MatchedChunk[] {
  if (allowedChapters.size === 0) return chunks;
  return chunks.filter((chunk) => {
    if (pinnedKeys.has(dafaGroupKey(chunk))) return true;
    const chapter = chunk.chapter?.trim();
    if (!chapter) return false;
    return allowedChapters.has(chapter);
  });
}

/** Lightweight index: दफा titles in a chapter (no full text). */
async function listChapterDafaIndex(
  chapter: string,
  scope: BookScope
): Promise<Array<{ section: string; title: string }>> {
  const docIds = await getDocumentIdsForBookScope(scope);
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
    const section =
      toArabicDigits(
        String(row.metadata?.section_dafa ?? row.section_label ?? "")
      ) || sectionRootLabel({
        section_label: row.section_label,
      } as MatchedChunk);
    if (!section || byDafa.has(section)) continue;
    const title = row.section_title?.trim() ?? "";
    byDafa.set(section, title);
  }

  return [...byDafa.entries()].map(([section, title]) => ({ section, title }));
}

/** Lowest-numbered root दफा in a stored परिच्छेद row (chapter opener / definition). */
export async function resolveFirstDafaInChapter(
  chapter: string,
  scope: BookScope
): Promise<string | null> {
  const index = await listChapterDafaIndex(chapter, scope);
  if (index.length === 0) return null;

  const numeric = index
    .map(({ section }) => ({ section, num: Number(toArabicDigits(section)) }))
    .filter(({ num }) => Number.isFinite(num) && num > 0)
    .sort((a, b) => a.num - b.num);

  return numeric[0]?.section ?? null;
}

/** Resolve full stored chapter label for a hinted दफा. */
export async function resolveChapterForSection(
  sectionOrHint: string | { section: string; act: string },
  scope: BookScope
): Promise<string | null> {
  const section =
    typeof sectionOrHint === "string"
      ? sectionOrHint
      : sectionOrHint.section;
  const hintScope =
    typeof sectionOrHint === "string"
      ? scope
      : normalizeActToBookScope(sectionOrHint.act) ?? scope;

  const batch = await retrieveSectionsByMetadataBatch(
    [toArabicDigits(section)],
    hintScope
  );
  return batch[0]?.chapter?.trim() ?? null;
}

/** Expand a chapter by scoring दफा titles, then batch-fetch only winners. */
async function expandSingleChapterSections(
  chapter: string,
  scope: BookScope,
  seeded: MatchedChunk[],
  queryText: string
): Promise<MatchedChunk[]> {
  const seededSections = new Set(
    seeded
      .filter((c) => bookScopeFromFilename(c.filename) === scope)
      .map((c) => sectionRootLabel(c))
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
    if (score < 0.12) continue;
    if (toFetch.length >= CHAPTER_EXPANSION_MAX_SECTIONS) break;
    toFetch.push(section);
    seededSections.add(section);
  }

  if (toFetch.length === 0) return [];

  const batch = await retrieveScopedSectionsBatch(toFetch, scope);
  return batch.map((chunk) => ({
    ...chunk,
    similarity: Math.max(chunk.similarity, CHAPTER_EXPAND_SIMILARITY),
  }));
}

/** Pull sibling दफा from LLM-identified परिच्छेद only (not from vector hits). */
async function expandChapterSectionsFromAnalysis(
  chapterTargets: Map<string, { chapter: string; scope: BookScope }>,
  seeded: MatchedChunk[],
  queryText: string
): Promise<MatchedChunk[]> {
  if (chapterTargets.size === 0) return [];

  const expansions = await Promise.all(
    [...chapterTargets.values()].map(({ chapter, scope }) =>
      expandSingleChapterSections(chapter, scope, seeded, queryText)
    )
  );
  return expansions.flat();
}

type AnalysisHintOptions = {
  queryText?: string;
  /** Advocate fast path: only matched परिच्छेद + pinned दफा; skip title search. */
  chapterScoped?: boolean;
};

export type AdvocateHintResult = {
  chunks: MatchedChunk[];
  allowedChapters: Set<string>;
};

/** Fetch दफा suggested by query analysis (LLM hints + optional परिच्छेद expansion). */
export async function retrieveFromAnalysisHints(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope = "auto",
  options: AnalysisHintOptions = {}
): Promise<AdvocateHintResult> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const merged: MatchedChunk[] = [];
  const pinnedKeys = new Set<string>();

  const queryText =
    options.queryText ??
    [
      analysis.originalQuery,
      analysis.intent,
      ...analysis.legalIssues,
      ...analysis.retrievalQueries,
    ].join(" ");

  const byScope = new Map<BookScope, string[]>();
  for (const hint of analysis.sectionHints) {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) continue;
    if (scopedIds && !scopedIds.includes(scope)) continue;
    if (!scopedIds && legacyScope !== "auto" && scope !== legacyScope) continue;
    const list = byScope.get(scope) ?? [];
    if (!list.includes(hint.section)) list.push(hint.section);
    byScope.set(scope, list);
  }

  const sectionFetches = await Promise.all(
    [...byScope.entries()].map(async ([scope, sections]) => ({
      scope,
      batch: await retrieveScopedSectionsBatch(sections, scope),
    }))
  );

  for (const { batch } of sectionFetches) {
    for (const chunk of batch) {
      pinnedKeys.add(dafaGroupKey(chunk));
      merged.push({ ...chunk, similarity: Math.max(chunk.similarity, 0.92) });
    }
  }

  if (!options.chapterScoped) {
    const titlePhrases = new Set(analysis.titleSearchHints);
    for (const issue of analysis.legalIssues) {
      const multiWord = issue.includes(" ") || issue.includes("।");
      if (multiWord && issue.length >= 4 && issue.length <= 80) {
        titlePhrases.add(issue);
      } else if (!multiWord && issue.length >= 10 && issue.length <= 80) {
        titlePhrases.add(issue);
      }
    }
    if (analysis.intent.length >= 8 && analysis.intent.length <= 100) {
      titlePhrases.add(analysis.intent);
    }

    for (const title of titlePhrases) {
      const scope = scopedIds
        ? scopedIds[0]
        : legacyScope !== "auto"
          ? legacyScope
          : preferredActToBookScope(analysis.preferredAct) ??
            queryHintToBookScope(title) ??
            "auto";
      const match = await retrieveByProvisionTitle(title, scope);
      if (!match?.chunks.length) continue;
      for (const chunk of match.chunks) {
        merged.push({ ...chunk, similarity: Math.max(chunk.similarity, 0.91) });
      }
    }
  }

  const chapterTargets = await resolveChapterTargets(analysis, bookScope);

  const skipChapterExpansion =
    options.chapterScoped &&
    analysis.sectionHints.length >= 1;

  if (chapterTargets.size > 0 && !skipChapterExpansion) {
    const chapterExpanded = await expandChapterSectionsFromAnalysis(
      chapterTargets,
      merged,
      queryText
    );
    merged.push(...chapterExpanded);
  }

  const allowedChapters = new Set(
    [...chapterTargets.values()].map(({ chapter }) => chapter)
  );

  let filtered =
    options.chapterScoped && allowedChapters.size > 0
      ? filterChunksToChapterScope(merged, allowedChapters, pinnedKeys)
      : merged;

  if (filtered.length === 0) return { chunks: [], allowedChapters };

  console.log(
    "[HandyLaw analysis hints]",
    JSON.stringify(
      {
        chapterScoped: options.chapterScoped ?? false,
        skipChapterExpansion,
        sectionHints: analysis.sectionHints,
        chapterHints: analysis.chapterHints,
        allowedChapters: [...allowedChapters],
        hits: filtered.map((c) => ({
          dafa: c.section_label?.split(".")[0],
          chapter: c.chapter,
          sim: c.similarity,
          file: c.filename,
        })),
      },
      null,
      2
    )
  );

  return {
    chunks: dedupeChunksByBestScore(filtered),
    allowedChapters,
  };
}

/** Keep only matched परिच्छेद + explicitly pinned दफा (section/topic hints). */
export function filterAdvocateChapterScope(
  chunks: MatchedChunk[],
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  extraPinned: MatchedChunk[] = [],
  allowedChapters?: Set<string>
): MatchedChunk[] {
  if (!allowedChapters || allowedChapters.size === 0) return chunks;
  const pinnedKeys = new Set(extraPinned.map((c) => dafaGroupKey(c)));

  const scopedIds = targetBookIds(bookScope);
  const focusScope = scopedIds
    ? primaryBookId(bookScope)
    : bookScope !== "auto" && !Array.isArray(bookScope)
      ? bookScope
      : preferredActToBookScope(analysis.preferredAct) ?? null;

  for (const hint of analysis.sectionHints) {
    const hintScope = normalizeActToBookScope(hint.act);
    if (!hintScope) continue;
    if (focusScope && hintScope !== focusScope) continue;
    const sectionArabic = toArabicDigits(hint.section);
    for (const chunk of chunks) {
      const scope = bookScopeFromFilename(chunk.filename);
      if (scope === hintScope && sectionRootLabel(chunk) === sectionArabic) {
        pinnedKeys.add(dafaGroupKey(chunk));
      }
    }
  }

  return filterChunksToChapterScope(chunks, allowedChapters, pinnedKeys);
}

/** Title-search fallback when vector/hints miss — uses analysis phrases + query. */
export async function retrieveAnalysisTitleFallback(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  queryText: string
): Promise<MatchedChunk[]> {
  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const phrases = buildTitleSearchPhrases(analysis, queryText);
  const merged: MatchedChunk[] = [];

  for (const title of phrases) {
    const scope = scopedIds
      ? scopedIds[0]
      : legacyScope !== "auto"
        ? legacyScope
        : preferredActToBookScope(analysis.preferredAct) ??
          queryHintToBookScope(title) ??
          queryHintToBookScope(queryText) ??
          "auto";
    const match = await retrieveByProvisionTitle(title, scope);
    if (!match?.chunks.length) continue;
    for (const chunk of match.chunks) {
      merged.push({ ...chunk, similarity: Math.max(chunk.similarity, 0.9) });
    }
  }

  return dedupeChunksByBestScore(merged);
}

/** Fast advocate retrieval: pinned दफा + matched परिच्छेद + title search. */
export async function retrieveAdvocateFromHints(
  analysis: QueryAnalysis,
  bookScope: ParsedBookScope,
  queryText: string,
  options: { chapterScoped?: boolean } = {}
): Promise<AdvocateHintResult> {
  return retrieveFromAnalysisHints(analysis, bookScope, {
    queryText,
    chapterScoped: options.chapterScoped ?? false,
  });
}

/** Fetch all indexed parts of a दफा within one act (used by advocate topic pins). */
export async function retrieveScopedSectionChunks(
  sectionNum: string,
  bookScope: BookScope,
  query = "",
  matchCount = SECTION_TOP_K
): Promise<MatchedChunk[]> {
  return retrieveBySectionNumber(sectionNum, matchCount, query, bookScope);
}

/** Single best chunk when indexer emitted duplicate उपदफा rows for the same marker. */
function patchChunkArrowBody(
  chunk: MatchedChunk,
  marker: string,
  newTail: string
): MatchedChunk {
  const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
  const prefix = body.replace(/\s*->\s*\([^)]+\)\s*[\s\S]*$/u, "").trim();
  const displayMarker = toNepaliNumberDisplay(marker);
  const newBody = `${prefix} -> (${displayMarker}) ${newTail}`;
  const headerEnd = chunk.content.indexOf(body);
  const header = headerEnd >= 0 ? chunk.content.slice(0, headerEnd) : "";
  return {
    ...chunk,
    content: `${header}${newBody}`,
    subsection: `(${displayMarker})`,
  };
}

function mergeUpadafaThreeText(good3Text: string, orphanTail: string): string {
  const tail = orphanTail.replace(/^\(\s*१\s*\)\s*/, "").trim();
  const stem = good3Text.trim();
  if (/मा लेखिएको म्यादभन्दा/.test(stem)) return stem;
  if (/^मा लेखिएको/.test(tail)) {
    const base = stem.replace(/\s*उपदफा\s*$/u, "").trim();
    return `${base} उपदफा (१) ${tail}`;
  }
  return `${stem} ${tail}`.replace(/\s+/g, " ").trim();
}

/**
 * Indexer sometimes splits one उपदफा into a stub (e.g. "-> (२) उपदफा") plus a
 * mislabeled sibling (e.g. metadata उपदफा १ with "(१) विपरीत..." text). Merge before dedupe.
 */
function repairMisplacedUpadafaParts(chunks: MatchedChunk[]): MatchedChunk[] {
  const parsed = chunks.map((chunk) => {
    const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
    const { path, text } = parseProvisionPath(body);
    return { chunk, path, text };
  });

  const drop = new Set<string>();
  const patches = new Map<string, MatchedChunk>();

  const stub2 = parsed.find(
    (p) => p.path[0] === "२" && /^उपदफा\s*$/u.test(p.text.trim())
  );
  const viparitOrphan = parsed.find(
    (p) => p.path[0] === "१" && /विपरीत हुने गरी/.test(p.text)
  );
  if (stub2 && viparitOrphan) {
    const tail = viparitOrphan.text.replace(/^\(\s*१\s*\)\s*/, "").trim();
    patches.set(
      stub2.chunk.id,
      patchChunkArrowBody(
        stub2.chunk,
        "२",
        tail.startsWith("उपदफा") ? tail : `उपदफा (१) ${tail}`
      )
    );
    drop.add(viparitOrphan.chunk.id);
  }

  const maLekhiekoOrphan = parsed.find(
    (p) => p.path[0] === "१" && /मा लेखिएको म्यादभन्दा/.test(p.text)
  );
  const good3 = parsed.find(
    (p) => p.path[0] === "३" && /कुनै ब्यक्तिलाई/.test(p.text)
  );
  if (maLekhiekoOrphan) {
    if (good3 && /मा लेखिएको म्यादभन्दा/.test(good3.text)) {
      drop.add(maLekhiekoOrphan.chunk.id);
    } else if (good3) {
      const merged = mergeUpadafaThreeText(good3.text, maLekhiekoOrphan.text);
      patches.set(good3.chunk.id, patchChunkArrowBody(good3.chunk, "३", merged));
      drop.add(maLekhiekoOrphan.chunk.id);
    } else {
      const bamojim3 = parsed.find(
        (p) => p.path[0] === "३" && /^बमोजिम/.test(p.text.trim())
      );
      if (bamojim3) {
        const merged = mergeUpadafaThreeText("कुनै ब्यक्तिलाई", maLekhiekoOrphan.text);
        patches.set(
          bamojim3.chunk.id,
          patchChunkArrowBody(bamojim3.chunk, "३", merged)
        );
        drop.add(maLekhiekoOrphan.chunk.id);
      }
    }
  }

  for (const p of parsed) {
    if (drop.has(p.chunk.id) || patches.has(p.chunk.id)) continue;
    if (p.path.length !== 1 || !p.path[0]) continue;
    if (!/^उपदफा\s*$/u.test(p.text.trim())) continue;

    const marker = p.path[0];
    const orphan = parsed.find(
      (o) =>
        !drop.has(o.chunk.id) &&
        o.chunk.id !== p.chunk.id &&
        o.path.length === 1 &&
        o.path[0] === "१" &&
        /^(?:\([०-९]+\)\s*)?बमोजिम/.test(o.text.trim())
    );
    if (!orphan) continue;

    const tail = orphan.text.trim();
    const merged = /^उपदफा\s*\(/.test(tail)
      ? tail
      : /^\([०-९]+\)\s*बमोजिम/.test(tail)
        ? `उपदफा ${tail}`
        : `उपदफा (१) ${tail}`;
    patches.set(p.chunk.id, patchChunkArrowBody(p.chunk, marker, merged));
    drop.add(orphan.chunk.id);
  }

  return chunks
    .filter((c) => !drop.has(c.id))
    .map((c) => patches.get(c.id) ?? c);
}

function advocateSectionPartKey(chunk: MatchedChunk): string {
  const root = sectionRootLabel(chunk);
  const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
  const upadafa = toArabicDigits(String(meta.subsection_upadafa ?? ""));
  const khanda = String(meta.clause_khanda ?? "").trim();
  const chunkType = String(meta.chunk_type ?? "");
  if (khanda) {
    return `${chunk.filename}|${root}|u${upadafa || "?"}|k${khanda}`;
  }
  if (upadafa) {
    return `${chunk.filename}|${root}|u${upadafa}|${chunkType || "upadafa"}`;
  }
  const sub = chunk.subsection?.replace(/[()]/g, "").trim() || "_root";
  return `${chunk.filename}|${root}|${sub}`;
}

function dedupeAdvocateSectionParts(chunks: MatchedChunk[]): MatchedChunk[] {
  const groups = new Map<string, MatchedChunk[]>();
  for (const chunk of chunks) {
    const key = advocateSectionPartKey(chunk);
    const list = groups.get(key) ?? [];
    list.push(chunk);
    groups.set(key, list);
  }

  const out: MatchedChunk[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const scored = list.map((chunk) => {
      const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
      const { path, text } = parseProvisionPath(body);
      const subDigits = chunk.subsection
        ? toArabicDigits(chunk.subsection.replace(/[^\d०-९]/g, ""))
        : "";
      const pathDigits = path[0] ? toArabicDigits(path[0]) : "";
      let score = 0;
      if (subDigits && pathDigits && subDigits === pathDigits) score += 4;
      if (path.length >= 2) score += 2;
      if (/चौबीस घण्टा|कुनै ब्यक्तिलाई कसूरको/.test(text)) score += 3;
      if (/कुनै ब्यक्तिलाई|मा लेखिएको म्यादभन्दा/.test(text)) score += 5;
      if (/पन्ध्र दिन|पच्चीस दिन|हिरासतमा राख्ने आदेश/.test(text)) score += 8;
      if (/उपदफा\s*\(/.test(text)) score += 1;
      if (/^उपदफा\s*$/u.test(text.trim())) score -= 10;
      if (/^बमोजिम/.test(text.trim()) && text.trim().length < 180) score -= 3;
      return { chunk, score };
    });
    scored.sort((a, b) => b.score - a.score || b.chunk.content.length - a.chunk.content.length);
    out.push(scored[0].chunk);
  }
  return out;
}

/**
 * Vector hits often return one merged दफा stub; replace with all indexed उपदफा parts
 * so advocate verbatim blocks include every clause.
 */
export async function hydrateAdvocateSectionChunks(
  chunks: MatchedChunk[],
  bookScope: ParsedBookScope,
  options: { skipLinkedHydration?: boolean } = {}
): Promise<MatchedChunk[]> {
  if (chunks.length === 0) return chunks;

  const scopedIds = targetBookIds(bookScope);
  const legacyScope = primaryBookId(bookScope);
  const targets = new Map<string, { section: string; scope: BookScope; boost: number }>();
  for (const chunk of chunks) {
    const root = sectionRootLabel(chunk);
    if (!root || !/^\d+$/.test(root)) continue;
    const scope = bookScopeFromFilename(chunk.filename);
    if (!scope) continue;
    if (scopedIds && !scopedIds.includes(scope)) continue;
    if (!scopedIds && legacyScope !== "auto" && scope !== legacyScope) continue;
    const effectiveScope =
      legacyScope !== "auto" && !Array.isArray(bookScope)
        ? legacyScope
        : scope;
    const key = `${effectiveScope}|${root}`;
    const prev = targets.get(key);
    targets.set(key, {
      section: root,
      scope: effectiveScope,
      boost: Math.max(prev?.boost ?? 0, chunk.similarity),
    });
  }

  if (targets.size === 0) return chunks;

  const hydrated: MatchedChunk[] = [];
  const seen = new Set<string>();
  const hydratedSectionKeys = new Set<string>();

  for (const { section, scope, boost } of targets.values()) {
    const raw = await retrieveScopedSectionsBatch([section], scope);
    const parts = dedupeAdvocateSectionParts(repairMisplacedUpadafaParts(raw));
    hydratedSectionKeys.add(`${scope}|${section}`);
    for (const part of parts) {
      if (!filenameMatchesScope(part.filename, scope)) continue;
      if (seen.has(part.id)) continue;
      seen.add(part.id);
      hydrated.push({
        ...part,
        similarity: Math.max(part.similarity, boost, 0.85),
      });
    }
  }

  for (const chunk of chunks) {
    const root = sectionRootLabel(chunk);
    const scope = bookScopeFromFilename(chunk.filename);
    if (root && scope && hydratedSectionKeys.has(`${scope}|${root}`)) continue;
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    hydrated.push(chunk);
  }

  return options.skipLinkedHydration
    ? sortChunksHierarchically(hydrated)
    : hydrateLinkedProvisionChunks(
        sortChunksHierarchically(hydrated),
        primaryBookId(bookScope)
      );
}

/** Single-query batch fetch for multiple दफा (advocate topic pins). */
export async function retrieveScopedSectionsBatch(
  sectionNums: string[],
  bookScope: BookScope
): Promise<MatchedChunk[]> {
  const unique = [...new Set(sectionNums)];
  const metadata = await retrieveSectionsByMetadataBatch(unique, bookScope);
  if (metadata.length > 0) return metadata;

  const out: MatchedChunk[] = [];
  for (const section of unique) {
    out.push(
      ...(await retrieveBySectionNumber(section, SECTION_TOP_K, "", bookScope))
    );
  }
  return out;
}

/** Parse optional retry payload — root दफा integers to exclude from retrieval. */
export function parseExcludeDafaList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const roots = new Set<number>();
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item) && item > 0) {
      roots.add(item);
      continue;
    }
    if (typeof item === "string" && item.trim()) {
      const n = Number(toArabicDigits(item.trim()));
      if (Number.isFinite(n) && n > 0) roots.add(n);
    }
  }
  return [...roots];
}

function excludeDafaRootSet(excludeDafas: number[]): Set<string> {
  return new Set(excludeDafas.map((d) => toArabicDigits(String(d))));
}

/** Drop chunks whose root दफा is in the temporary retry exclude list. */
export function filterExcludedDafaChunks(
  chunks: MatchedChunk[],
  excludeDafas: number[]
): MatchedChunk[] {
  if (excludeDafas.length === 0) return chunks;
  const excluded = excludeDafaRootSet(excludeDafas);
  return chunks.filter((chunk) => {
    const root = chunk.section_label?.split(".")[0];
    if (!root) return true;
    return !excluded.has(toArabicDigits(root));
  });
}
