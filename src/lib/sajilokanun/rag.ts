import { streamChat, streamVerbatim } from "./chat";
import { buildAdvocatePromptCacheKey } from "./advocate-chat-cache";
import {
  buildKharejCourtFeeSaransh,
  buildKharejMuddha,
  buildMilapatraCourtFeeSaransh,
  buildMilapatraMuddha,
  filterKharejCourtFeeChunks,
  filterMilapatraCourtFeeChunks,
} from "./advocate-saransh";
import {
  buildAdvocateNarrativeSystemPrompt,
  buildAdvocateNarrativeUserPrompt,
  parseAdvocateNarrative,
} from "./advocacy-prompts";
import { completeChat } from "./ai";
import {
  citationFromChunk,
  formatCitationBlock,
} from "./chunk-metadata";
import { getProvisionBody, formatAdvocateProvisionBody } from "./provision-body";
import { toArabicDigits } from "./nepali-digits";
import { formatSourceLabel, UI_SOURCES_PANEL_MAX } from "./source-label";
import { mergeSectionChunks } from "./merge-section-chunks";
import { formatHierarchicalSectionAnswer, formatChapterProvisionAnswer, sortChunksHierarchically, parseProvisionPath } from "./hierarchical-section";
import { applyChunkConflictPinning } from "./chunk-conflict-mandates";
import {
  applyDefinitionalChapterPin,
  hydratePrarambhikDefinitionChunks,
  isDefinitionalQuery,
  prioritizeDefinitionalFirstDafa,
  sanitizeDefinitionalTitleHints,
} from "./definitional-chapter-pin";
import {
  filterAdvocateRetrievalChunks,
  focusAdvocateChunks,
  dropIntroductoryDefinitionNoise,
  needsTitleSearchFallback,
  prioritizeSectionHintChunks,
  sortAdvocateCollapsedChunks,
  limitAdvocateDafaChunks,
  isPolygamyQuery,
  isContractValidityQuery,
  isCustodyPresentQuery,
  isJaheriRegistrationRefusalQuery,
  isFalseComplaintQuery,
  isKharejCourtFeeRefundQuery,
  isMarriageAgeQuery,
  isMilapatraCourtFeeQuery,
  isMurderQuery,
  isPratiuttarDeadlineQuery,
  isPratiuttarAfterTamelDeadlineQuery,
  isPratiuttarQuery,
  isTheftQuery,
  queryHintToBookScope,
} from "./legal-retrieval-boost";
import { analyzeQuery, type QueryAnalysis } from "./query-analysis";
import { runHierarchicalChapterRetrieval, resolveChaptersFromSectionHints, type HierarchicalChapterResult } from "./hierarchical-chapter-retrieval";
import {
  extractChunkIdFromQuery,
  extractSectionFromQuery,
  extractStructuredLegalRef,
  resolveBookFilter,
  retrieveAdvocateFromHints,
  retrieveAnalysisTitleFallback,
  retrieveByStructuredRef,
  retrieveByProvisionTitle,
  retrieveChunks,
  retrieveChunksMulti,
  retrieveChunksSplitHybrid,
  retrieveDeterministicAdvocateSeeds,
  filterAdvocateChapterScope,
  retrieveScopedSectionChunks,
  retrieveScopedSectionsBatch,
  hydrateAdvocateSectionChunks,
  retrieveByProvisionTitleCandidates,
  filterExcludedDafaChunks,
  type AdvocateHintResult,
  ADVOCATE_TOP_K,
  ADVOCATE_CONTEXT_MAX,
  ADVOCATE_UI_SOURCES_MAX,
} from "./retrieve";
import { isStructuredLegalQuery, isProvisionTitleQuery } from "./structured-legal-query";
import { filenameMatchesScope, normalizeActToBookScope, type BookScope } from "./lawbooks";
import {
  filenameMatchesAnyBookScope,
  primaryBookId,
  targetBookIds,
  type ParsedBookScope,
} from "./book-scope";
import { type MatchedChunk } from "./supabase";
import { fuseRankedListsRRF } from "./rrf-fusion";
import { findQuestionTopicPin, questionTopicPinToAnalysis } from "./question-topic-pins";
import {
  sanitizeAdvocateAnalysis,
  buildAdvocateRetrievalPolicy,
  filterToSectionHints,
  dropBigoCourtFeeCollision,
  applyEmbeddedTitleMatchToAnalysis,
  sectionHintKeys,
} from "./advocate-retrieval-policy";
import {
  topProvisionTitleCandidates,
  MIN_PROVISION_TITLE_SCORE,
} from "./provision-title-search";

import type { AnswerMode } from "./answer-mode";
import { buildAdvocateEmbedQuery } from "./embedding-text";
import { retrieveAdvocateHybridSearch } from "./advocate-hybrid-search";

export type { AnswerMode } from "./answer-mode";

const ROMAN_TO_DEVANAGARI_KHANDA: Record<string, string> = {
  ka: "क", kha: "ख", ga: "ग", gha: "घ", nga: "ङ",
  cha: "च", chha: "छ", ja: "ज", jha: "झ", nya: "ञ",
  ta: "ट", tha: "ठ", da: "ड", dha: "ढ", na: "न",
  pa: "प", pha: "फ", ba: "ब", bha: "भ", ma: "म",
  ya: "य", ra: "र", la: "ल", va: "व",
  sha: "श", sa: "स", ha: "ह",
};

function normalizeKhandaToDevanagari(khanda: string): string {
  if (/^[क-ह]$/.test(khanda)) return khanda;
  return ROMAN_TO_DEVANAGARI_KHANDA[khanda.toLowerCase()] ?? khanda;
}

function provisionText(content: string): string {
  return getProvisionBody(content);
}

export function buildContext(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const citation = citationFromChunk(chunk.content, chunk.filename);
      const meta = formatCitationBlock(citation);
      const text = provisionText(chunk.content);
      return `[Source ${index + 1}]\n${meta}\n\n${text}`;
    })
    .join("\n\n---\n\n");
}

function buildVerbatimProvisionsBlock(
  chunks: MatchedChunk[],
  query: string
): string {
  return chunks
    .map((chunk) => {
      const source = formatSourceLabel(
        {
          filename: chunk.filename,
          section_label: chunk.section_label,
          chapter: chunk.chapter,
          content: chunk.content,
        },
        { boldChapter: true }
      );
      let body = /^पुस्तक\s*:/m.test(chunk.content.trim())
        ? getProvisionBody(chunk.content)
        : chunk.content.trim();
      body = formatAdvocateProvisionBody(body, query);
      return `**स्रोत:** ${source}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}

function buildAdvocateContext(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const isFormattedSection = /^पुस्तक\s*:/m.test(chunk.content.trim());
      const citation = citationFromChunk(chunk.content, chunk.filename);
      const meta = formatCitationBlock(citation);
      const source = formatSourceLabel(
        {
          filename: chunk.filename,
          section_label: chunk.section_label ?? citation.sectionNumber,
          chapter: chunk.chapter,
          content: chunk.content,
        },
        { boldChapter: true }
      );
      const text = isFormattedSection
        ? chunk.content.trim()
        : getProvisionBody(chunk.content);
      return `[Source ${index + 1}]\nस्रोत: ${source}\n${meta}\n\n${text}`;
    })
    .join("\n\n---\n\n");
}

function sectionGroupKey(chunk: MatchedChunk): string {
  const section = chunk.section_label?.split(".")[0] ?? "unknown";
  return `${chunk.filename}|${section}`;
}

export type UiSourceChunk = MatchedChunk & {
  /** True when shown as an extra related hit (not used in the answer body). */
  related?: boolean;
};

/** Related extras only appear when match % is at least 70. */
function meetsRelatedMatchFloor(similarity: number): boolean {
  return Math.round(similarity * 100) >= 70;
}

/**
 * Build विस्तृत स्रोत list: keep primary (answer) दफा first, then fill with
 * other unique hits up to `max` (any act / book allowed in related pool).
 * Related fillers require at least a 70% match score.
 */
function mergeSourcesForPanel(
  primary: MatchedChunk[],
  relatedPool: MatchedChunk[],
  max: number = UI_SOURCES_PANEL_MAX
): UiSourceChunk[] {
  const out: UiSourceChunk[] = [];
  const seen = new Set<string>();

  for (const chunk of primary) {
    const key = sectionGroupKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...chunk, related: false });
    if (out.length >= max) return out;
  }

  const relatedSorted = [...relatedPool]
    .filter((chunk) => meetsRelatedMatchFloor(chunk.similarity))
    .sort((a, b) => b.similarity - a.similarity);
  for (const chunk of relatedSorted) {
    const key = sectionGroupKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...chunk, related: true });
    if (out.length >= max) break;
  }

  return out;
}

/** Prefer existing chunks for tags/panel; fetch cross-act related when thin. */
async function sourcesForExpandedPanel(
  queryUsed: string,
  primary: MatchedChunk[],
  relatedPool: MatchedChunk[] = [],
  max: number = UI_SOURCES_PANEL_MAX
): Promise<UiSourceChunk[]> {
  let pool = relatedPool;
  const uniquePrimary = mergeSourcesForPanel(primary, [], max);
  if (uniquePrimary.length >= max) return uniquePrimary;

  const pooledUnique = mergeSourcesForPanel(primary, pool, max);
  if (pooledUnique.length >= max) return pooledUnique;

  try {
    const { chunks: acrossActs } = await retrieveChunks(
      queryUsed,
      undefined,
      "auto"
    );
    pool = [...pool, ...acrossActs];
  } catch (error) {
    console.warn("Related sources (any-act) fetch failed:", error);
  }

  return mergeSourcesForPanel(primary, pool, max);
}

function advocateSourcesForUi(chunks: MatchedChunk[]): MatchedChunk[] {
  return mergeSourcesForPanel(chunks, [], ADVOCATE_UI_SOURCES_MAX);
}

/** Merge indexed sub-chunks into one readable block per दफा for advocate LLM context. */
function collapseAdvocateSectionGroups(chunks: MatchedChunk[]): MatchedChunk[] {
  const groups = new Map<string, MatchedChunk[]>();
  for (const chunk of chunks) {
    const key = sectionGroupKey(chunk);
    const list = groups.get(key) ?? [];
    list.push(chunk);
    groups.set(key, list);
  }

  const collapsed: MatchedChunk[] = [];
  for (const [, parts] of groups) {
    const sorted = sortChunksHierarchically(parts);
    if (sorted.length === 1) {
      collapsed.push(sorted[0]);
      continue;
    }
    const maxSim = Math.max(...sorted.map((c) => c.similarity));
    const first = sorted[0];
    const formatted = formatHierarchicalSectionAnswer(sorted);
    collapsed.push({
      ...first,
      content: formatted,
      section_label: first.section_label?.split(".")[0] ?? first.section_label,
      similarity: maxSim,
    });
  }

  return collapsed.sort((a, b) => {
    const aCivil = /देवानी संहिता/.test(a.filename) ? 0 : 1;
    const bCivil = /देवानी संहिता/.test(b.filename) ? 0 : 1;
    if (aCivil !== bCivil) return aCivil - bCivil;
    return (a.section_label ?? "").localeCompare(b.section_label ?? "");
  });
}

export function buildSystemPrompt(): string {
  return `You are HandyLaw, a Nepali legal assistant. Answer questions using ONLY the provided legal document excerpts.

Rules:
- Quote the provision verbatim. Do not add commentary.
- Begin every answer with this metadata block (omit lines that are not in the source). Use Devanagari numerals (०–९) for all numbers, e.g. परिच्छेद नं : ११ not 11:
  पुस्तक : (book name)
  परिच्छेद नं : (chapter number)
  परिच्छेद नाम : (chapter name)
  दफा : (section number and title)
  उपदफा : (subsection, if any)
- Then quote the provision text exactly as written in the source.
- Format enumerated clauses as a list: put each marker on its own line — (१), (२) for main items; (क), (ख), (ग) for sub-items indented under the parent. Do not change any wording; only add line breaks for readability.
- Answer only from the provided context. If the context does not contain enough information, say you cannot find that information in the provided laws.
- Respond in the same language as the user's question (Nepali or English).
- Do not invent laws, penalties, or explanations not present in the context.`;
}

export function buildUserPrompt(question: string, context: string): string {
  return `Context from legal documents:

${context}

Question: ${question}`;
}

export function formatVerbatimSectionAnswer(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk) => {
      const citation = citationFromChunk(chunk.content, chunk.filename);
      const meta = formatCitationBlock(citation);
      const text = provisionText(chunk.content);
      return `${meta}\n\n${text}`;
    })
    .join("\n\n---\n\n");
}

/** Expand to full दफा only when metadata hit returned a breadcrumb stub. */
function hierarchicalChunksNeedFullSection(chunks: MatchedChunk[]): boolean {
  return chunks.some((chunk) => {
    const body = getProvisionBody(chunk.content).trim();
    const { text } = parseProvisionPath(body);
    const display = text.replace(/^->\s*(\([^)]+\)\s*)+/u, "").trim();
    return display.length < 30 || /^उपदफा\s*$/u.test(display);
  });
}

async function enrichTopicAdvocateChunks(
  query: string,
  bookScope: ParsedBookScope
): Promise<MatchedChunk[] | null> {
  const scopeOk = (target: BookScope) =>
    bookScope === "auto" ||
    (Array.isArray(bookScope)
      ? bookScope.includes(target)
      : bookScope === target);

  const topicPin = findQuestionTopicPin(query);
  if (topicPin) {
    if (!scopeOk(topicPin.scope)) return null;
    const sectionChunks = await loadSectionPinnedChunks(
      topicPin.sections.map((section) => ({
        section,
        scope: topicPin.scope,
      }))
    );
    if (topicPin.titles?.length) {
      const titleChunks = await loadTitlePinnedSections(
        topicPin.titles.map((title) => ({
          title,
          scope: topicPin.scope,
        }))
      );
      return mergeUniqueChunks(sectionChunks, titleChunks);
    }
    return sectionChunks;
  }

  if (isMarriageAgeQuery(query)) {
    const specs = [
      { title: "विवाह हुन सक्ने", scope: "civil-code" as const },
      { title: "बाल विवाह गर्न नहुने", scope: "criminal-code" as const },
    ].filter((s) => scopeOk(s.scope));
    if (specs.length === 0) return null;
    return loadTitlePinnedSections(specs);
  }

  if (isContractValidityQuery(query)) {
    if (!scopeOk("civil-code")) return null;
    const specs = [
      { title: "कानून बमोजिम कार्यान्वयन हुने करार", scope: "civil-code" as const },
      { title: "बदर हुने करार", scope: "civil-code" as const },
    ];
    return loadTitlePinnedSections(specs);
  }

  if (isMurderQuery(query)) {
    if (!scopeOk("criminal-code")) return null;
    return loadSectionPinnedChunks([{ section: "177", scope: "criminal-code" }]);
  }

  if (isTheftQuery(query)) {
    if (!scopeOk("criminal-code")) return null;
    return loadSectionPinnedChunks([
      { section: "241", scope: "criminal-code" },
      { section: "242", scope: "criminal-code" },
    ]);
  }

  if (isFalseComplaintQuery(query)) {
    if (!scopeOk("criminal-code")) return null;
    return loadTitlePinnedSections([
      { title: "झुठ्ठा उजुरी दिन नहुने", scope: "criminal-code" },
    ]);
  }

  if (isCustodyPresentQuery(query)) {
    if (!scopeOk("criminal-procedure")) return null;
    return loadSectionPinnedChunks([
      { section: "14", scope: "criminal-procedure" },
    ]);
  }

  if (isJaheriRegistrationRefusalQuery(query)) {
    if (!scopeOk("criminal-procedure")) return null;
    return loadSectionPinnedChunks([{ section: "5", scope: "criminal-procedure" }]);
  }

  if (isPratiuttarDeadlineQuery(query)) {
    const scope = queryHintToBookScope(query) ?? "civil-procedure";
    if (scope !== "civil-procedure") return null;

    const primarySection = isPratiuttarAfterTamelDeadlineQuery(query)
      ? "119"
      : "101";
    const sectionChunks = await loadSectionPinnedChunks([
      { section: primarySection, scope: "civil-procedure" },
      { section: "100", scope: "civil-procedure" },
      { section: "163", scope: "civil-procedure" },
      { section: "223", scope: "civil-procedure" },
      { section: "225", scope: "civil-procedure" },
      { section: "227", scope: "civil-procedure" },
      { section: "228", scope: "civil-procedure" },
    ]);
    return sectionChunks;
  }

  if (isMilapatraCourtFeeQuery(query)) {
    if (!scopeOk("civil-procedure")) return null;
    return loadSectionPinnedChunks([
      { section: "82", scope: "civil-procedure" },
      { section: "248", scope: "civil-procedure" },
    ]);
  }

  if (isKharejCourtFeeRefundQuery(query)) {
    if (!scopeOk("civil-procedure")) return null;
    return loadSectionPinnedChunks([{ section: "82", scope: "civil-procedure" }]);
  }

  return null;
}

function mergeUniqueChunks(...lists: Array<MatchedChunk[] | null>): MatchedChunk[] {
  const seen = new Set<string>();
  const out: MatchedChunk[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const chunk of list) {
      if (seen.has(chunk.id)) continue;
      seen.add(chunk.id);
      out.push(chunk);
    }
  }
  return sortChunksHierarchically(out);
}

async function enrichQuoteTopicChunks(
  query: string,
  originalQuestion: string,
  bookScope: ParsedBookScope
): Promise<MatchedChunk[] | null> {
  const combined = `${query} ${originalQuestion}`;
  if (!isPratiuttarQuery(combined)) return null;

  const scopedIds = targetBookIds(bookScope);
  const scope = scopedIds
    ? scopedIds.includes("civil-procedure")
      ? "civil-procedure"
      : null
    : bookScope !== "auto" && !Array.isArray(bookScope)
      ? bookScope
      : queryHintToBookScope(combined) ?? "civil-procedure";
  if (scope !== "civil-procedure") return null;

  const titleChunks = await loadTitlePinnedSections([
    { title: "प्रतिउत्तरपत्र पेश गर्नु पर्ने", scope: "civil-procedure" },
  ]);
  const replySection = isPratiuttarAfterTamelDeadlineQuery(combined)
    ? "119"
    : "101";
  const sectionChunks = await loadSectionPinnedChunks([
    { section: replySection, scope: "civil-procedure" },
  ]);

  const merged = mergeUniqueChunks(titleChunks, sectionChunks);
  return merged.length > 0 ? merged : null;
}

async function loadSectionPinnedChunks(
  specs: Array<{ section: string; scope: BookScope }>
): Promise<MatchedChunk[] | null> {
  if (specs.length === 0) return null;
  const scope = specs[0].scope;
  const sections = specs.map((s) => s.section);
  const chunks = await retrieveScopedSectionsBatch(sections, scope);
  const scoped = chunks.filter((c) => filenameMatchesScope(c.filename, scope));
  const sorted = sortChunksHierarchically(scoped);
  return sorted.length > 0 ? sorted : null;
}

async function loadTitlePinnedSections(
  specs: Array<{ title: string; scope: BookScope }>
): Promise<MatchedChunk[] | null> {
  const out: MatchedChunk[] = [];
  for (const { title, scope } of specs) {
    const match = await retrieveByProvisionTitle(title, scope);
    if (!match?.chunks.length) continue;
    const scoped = match.chunks.filter((c) =>
      filenameMatchesScope(c.filename, scope)
    );
    out.push(...sortChunksHierarchically(scoped));
  }
  return out.length > 0 ? out : null;
}

function applyExcludeDafasToSectionHints<T extends { section: string }>(
  hints: T[],
  excludeDafas: number[]
): T[] {
  if (excludeDafas.length === 0) return hints;
  const excluded = new Set(excludeDafas.map((d) => toArabicDigits(String(d))));
  return hints.filter(
    (h) => !excluded.has(toArabicDigits(h.section.split(".")[0]))
  );
}

async function streamAdvocateAnswer(
  queryUsed: string,
  originalQuestion: string,
  bookScope: ParsedBookScope,
  metadataHint?: import("./query-translate").QueryMetadataHint,
  searchKeywords?: string[],
  excludeDafas: number[] = []
): Promise<{
  stream: Awaited<ReturnType<typeof streamChat>>["stream"];
  sources: UiSourceChunk[];
  retrievalMode: "vector" | "keyword";
  analysis: QueryAnalysis;
}> {
  const metadataHintScope = metadataHint?.act
    ? (normalizeActToBookScope(metadataHint.act) ?? bookScope)
    : bookScope;

  const [analysis, deterministicChunks] = await Promise.all([
    analyzeQuery(queryUsed, primaryBookId(bookScope)),
    retrieveDeterministicAdvocateSeeds(queryUsed, bookScope),
  ]);
  analysis.originalQuery = originalQuestion;

  const topicPin = findQuestionTopicPin(queryUsed);
  const pinAnalysis = topicPin
    ? questionTopicPinToAnalysis(queryUsed, primaryBookId(bookScope))
    : null;
  if (pinAnalysis) {
    analysis.sectionHints = pinAnalysis.sectionHints;
    analysis.chapterHints = pinAnalysis.chapterHints;
    analysis.preferredAct = pinAnalysis.preferredAct;
    analysis.intent = pinAnalysis.intent || analysis.intent;
    analysis.legalIssues = [
      ...new Set([...pinAnalysis.legalIssues, ...analysis.legalIssues]),
    ].slice(0, 8);
    analysis.retrievalQueries = [
      ...new Set([
        ...pinAnalysis.retrievalQueries,
        ...analysis.retrievalQueries,
      ]),
    ].slice(0, 4);
  }

  const definitional = isDefinitionalQuery(queryUsed);
  const preservedSectionHints = pinAnalysis
    ? [...pinAnalysis.sectionHints]
    : definitional
      ? [...analysis.sectionHints]
      : undefined;

  if (definitional) {
    sanitizeDefinitionalTitleHints(analysis);
  }

  sanitizeAdvocateAnalysis(analysis, bookScope, queryUsed);

  const titleCandidates = topProvisionTitleCandidates(
    queryUsed,
    analysis.titleSearchHints
  );
  const embeddedTitleMatch =
    titleCandidates.length > 0
      ? await retrieveByProvisionTitleCandidates(titleCandidates, bookScope)
      : null;
  const hasMetadataExactDafa = (metadataHint?.exactDafaGuess?.length ?? 0) > 0;
  const embeddedTitleChunks =
    !pinAnalysis &&
    !definitional &&
    !hasMetadataExactDafa &&
    embeddedTitleMatch?.chunks.length &&
    (embeddedTitleMatch.score ?? 0) >= MIN_PROVISION_TITLE_SCORE
      ? applyEmbeddedTitleMatchToAnalysis(
          analysis,
          embeddedTitleMatch.chunks,
          embeddedTitleMatch.score ?? 0
        )
      : (embeddedTitleMatch?.chunks ?? []).map((c) => ({
          ...c,
          similarity: Math.max(c.similarity, 0.91),
        }));

  if (hasMetadataExactDafa) {
    applyMetadataExactDafaHintsToAnalysis(
      analysis,
      metadataHint!,
      metadataHintScope
    );
    analysis.sectionHints = applyExcludeDafasToSectionHints(
      analysis.sectionHints,
      excludeDafas
    );
  }

  sanitizeAdvocateAnalysis(analysis, bookScope, queryUsed);

  let policy = buildAdvocateRetrievalPolicy(analysis, bookScope, queryUsed, {
    fromTopicPin: Boolean(pinAnalysis),
  });

  const retrievalQueries = [
    ...analysis.retrievalQueries,
    ...analysis.legalIssues,
  ];

  const useMetadataHybrid = Boolean(
    metadataHint?.act || metadataHint?.exactDafaGuess?.length
  );
  const effectiveSearchKeywords =
    searchKeywords?.length
      ? searchKeywords
      : [...queryUsed.matchAll(/\(([^)]+)\)/gu)]
          .map((match) => match[1].trim())
          .filter(Boolean);

  const [hintResult, multiResult, hierarchicalResult, topicChunks, metadataHintChunks] =
    await Promise.all([
      retrieveAdvocateFromHints(analysis, bookScope, queryUsed, {
        chapterScoped: policy.chapterScoped,
      }),
      !policy.restrictGlobalMulti
        ? useMetadataHybrid
          ? retrieveAdvocateHybridSearch(
              {
                message: queryUsed,
                searchKeywords: effectiveSearchKeywords,
                metadataHint,
                bookScope,
                skipExactDafaInject: true,
              },
              ADVOCATE_TOP_K,
              buildAdvocateEmbedQuery(queryUsed, {
                preferredAct: analysis.preferredAct ?? metadataHint?.act,
                intent: analysis.intent,
              })
            )
          : effectiveSearchKeywords.length
            ? retrieveChunksSplitHybrid(
                queryUsed,
                effectiveSearchKeywords.join(" "),
                ADVOCATE_TOP_K,
                bookScope,
                buildAdvocateEmbedQuery(queryUsed, {
                  preferredAct: analysis.preferredAct,
                  intent: analysis.intent,
                })
              )
            : retrieveChunksMulti(
                retrievalQueries,
                ADVOCATE_TOP_K,
                bookScope,
                queryUsed,
                analysis.preferredAct,
                analysis
              )
        : Promise.resolve({
            chunks: [] as MatchedChunk[],
            mode: "keyword" as const,
          }),
      runHierarchicalChapterRetrieval(
        queryUsed,
        primaryBookId(bookScope),
        analysis
      ),
      pinAnalysis
        ? Promise.resolve(null)
        : enrichTopicAdvocateChunks(queryUsed, bookScope),
      useMetadataHybrid
        ? fetchMetadataHintChunks(
            metadataHint,
            metadataHintScope,
            queryUsed,
            excludeDafas
          )
        : Promise.resolve([] as MatchedChunk[]),
    ]);

  let hybridChunks = multiResult.chunks;
  let preparedMetadataHints: MatchedChunk[] = [];
  if (useMetadataHybrid && metadataHintChunks.length > 0) {
    const vectorTop = multiResult.chunks[0]?.similarity ?? 0.85;
    preparedMetadataHints = prepareMetadataHintChunksForFusion(
      metadataHintChunks,
      vectorTop
    );
    hybridChunks = fuseVectorAndHintChunks(multiResult.chunks, preparedMetadataHints);
    hybridChunks = boostFusedExactDafaHints(
      hybridChunks,
      (metadataHint?.exactDafaGuess ?? []).filter(
        (d) =>
          !excludeDafas.some(
            (ex) => toArabicDigits(String(ex)) === toArabicDigits(String(d))
          )
      ),
      vectorTop
    );
  }

  let merged = mergeUniqueChunks(
    !policy.restrictGlobalMulti
      ? focusAdvocateChunks(
          hybridChunks,
          queryUsed,
          analysis.preferredAct ?? metadataHint?.act
        )
      : [],
    embeddedTitleChunks,
    hintResult.chunks,
    deterministicChunks,
    hierarchicalResult.chunks,
    topicChunks ?? []
  );

  if (
    analysis.sectionHints.length === 0 &&
    hintResult.chunks.length === 0 &&
    merged.length < 3
  ) {
    const topicChunks = await enrichTopicAdvocateChunks(queryUsed, bookScope);
    merged = mergeUniqueChunks(merged, topicChunks);
  }

  if (!pinAnalysis && needsTitleSearchFallback(merged, analysis)) {
    const titleChunks = await retrieveAnalysisTitleFallback(
      analysis,
      bookScope,
      queryUsed
    );
    merged = mergeUniqueChunks(merged, titleChunks);
  }

  merged = filterExcludedDafaChunks(merged, excludeDafas);

  let definitionalFirstDafa: string | null = null;
  let definitionalScope: BookScope | null = null;
  let definitionalChapter: string | null = null;
  let definitionalPrarambhikChapter: string | null = null;
  if (definitional) {
    const defPin = await applyDefinitionalChapterPin(
      merged,
      queryUsed,
      analysis,
      bookScope,
      { preferredSectionHints: preservedSectionHints }
    );
    merged = defPin.chunks;
    definitionalFirstDafa = defPin.firstDafa;
    definitionalScope = defPin.scope;
    definitionalChapter = defPin.chapter;
    definitionalPrarambhikChapter = defPin.prarambhikChapter;
    if (defPin.sectionHints.length) {
      analysis.sectionHints = defPin.sectionHints;
    }
    if (defPin.chapterHint) {
      analysis.chapterHints = [defPin.chapterHint];
    }
    policy = {
      ...policy,
      strictSectionKeys: sectionHintKeys(analysis.sectionHints),
      chapterScoped: true,
    };
  }

  const conflict = applyChunkConflictPinning(
    merged,
    queryUsed,
    originalQuestion
  );
  merged = conflict.chunks;
  if (conflict.appliedRuleId && conflict.primaryDafa && conflict.scope) {
    analysis.sectionHints = [
      { section: conflict.primaryDafa, act: conflict.scope },
    ];
    analysis.chapterHints = [];
    policy = {
      ...policy,
      strictSectionKeys: sectionHintKeys(analysis.sectionHints),
      chapterScoped: true,
    };
  }

  merged = filterAdvocateRetrievalChunks(
    merged,
    analysis.preferredAct,
    queryUsed,
    analysis.sectionHints
  );
  merged = dropBigoCourtFeeCollision(merged, queryUsed);
  merged = dropIntroductoryDefinitionNoise(merged, analysis.sectionHints);
  if (analysis.sectionHints.length > 0) {
    merged = prioritizeSectionHintChunks(merged, analysis.sectionHints);
  }

  const sectionChapters = await resolveChaptersFromSectionHints(
    analysis,
    primaryBookId(bookScope)
  );
  const allowedChapters = new Set([
    ...hintResult.allowedChapters,
    ...hierarchicalResult.allowedChapters,
    ...sectionChapters,
    ...(definitionalChapter ? [definitionalChapter] : []),
    ...(definitionalPrarambhikChapter ? [definitionalPrarambhikChapter] : []),
  ]);

  const shouldScopeToChapter =
    allowedChapters.size > 0 &&
    (analysis.sectionHints.length > 0 ||
      analysis.chapterHints.length > 0 ||
      hierarchicalResult.routed);

  if (shouldScopeToChapter) {
    merged = filterAdvocateChapterScope(
      merged,
      analysis,
      bookScope,
      mergeUniqueChunks(hintResult.chunks, preparedMetadataHints),
      allowedChapters
    );
  }

  if (targetBookIds(bookScope)) {
    merged = merged.filter((c) =>
      filenameMatchesAnyBookScope(c.filename, bookScope)
    );
  } else if (bookScope !== "auto" && !Array.isArray(bookScope)) {
    merged = merged.filter((c) => filenameMatchesScope(c.filename, bookScope));
  }

  const advocateHydrateScope = hasMetadataExactDafa
    ? metadataHintScope
    : bookScope;

  merged = await hydrateAdvocateSectionChunks(merged, advocateHydrateScope, {
    skipLinkedHydration: hasMetadataExactDafa,
  });

  if (hasMetadataExactDafa) {
    const hintBook = primaryBookId(metadataHintScope);
    if (hintBook !== "auto") {
      merged = merged.filter((c) => filenameMatchesScope(c.filename, hintBook));
    }
  }

  merged = filterExcludedDafaChunks(merged, excludeDafas);

  if (definitionalFirstDafa && definitionalScope) {
    merged = prioritizeDefinitionalFirstDafa(
      merged,
      definitionalScope,
      definitionalFirstDafa
    );
  }

  if (policy.strictSectionKeys && !useMetadataHybrid) {
    merged = filterToSectionHints(merged, analysis.sectionHints);
  }

  if (definitionalScope) {
    const prarambhik = await hydratePrarambhikDefinitionChunks(definitionalScope);
    if (prarambhik.chunks.length > 0) {
      const boosted = prarambhik.chunks.map((c) => ({
        ...c,
        similarity: Math.max(c.similarity, 0.93),
      }));
      merged = mergeUniqueChunks(boosted, merged);
    }
  }

  let mode: "vector" | "keyword" = multiResult.mode;

  const provisionInput = isMilapatraCourtFeeQuery(queryUsed)
    ? filterMilapatraCourtFeeChunks(merged)
    : isKharejCourtFeeRefundQuery(queryUsed)
      ? filterKharejCourtFeeChunks(merged)
      : merged;

  const advocateMerged = filterExcludedDafaChunks(provisionInput, excludeDafas);

  const collapsed = sortAdvocateCollapsedChunks(
    collapseAdvocateSectionGroups(advocateMerged),
    analysis.sectionHints,
    hasMetadataExactDafa
  );
  const dafaLimited = limitAdvocateDafaChunks(
    collapsed,
    queryUsed,
    analysis.sectionHints,
    hasMetadataExactDafa
  );
  let chunks = dafaLimited.slice(0, ADVOCATE_CONTEXT_MAX);

  if (chunks.length === 0) {
    throw new Error(
      "No matching law sections found for this question. Try different keywords or select a specific act."
    );
  }

  const verbatimProvisions = buildVerbatimProvisionsBlock(chunks, queryUsed);

  if (isMilapatraCourtFeeQuery(queryUsed)) {
    const answer = [
      "**मुद्दा**",
      "",
      buildMilapatraMuddha(queryUsed),
      "",
      "**लागू प्रावधानहरू**",
      "",
      verbatimProvisions,
      "",
      "**सारांश**",
      "",
      buildMilapatraCourtFeeSaransh(chunks),
    ].join("\n");

    return {
      stream: streamVerbatim(answer),
      sources: await sourcesForExpandedPanel(
        queryUsed,
        advocateSourcesForUi(chunks),
        chunks,
        ADVOCATE_UI_SOURCES_MAX
      ),
      retrievalMode: mode,
      analysis,
    };
  }

  if (isKharejCourtFeeRefundQuery(queryUsed)) {
    const answer = [
      "**मुद्दा**",
      "",
      buildKharejMuddha(queryUsed, originalQuestion),
      "",
      "**लागू प्रावधानहरू**",
      "",
      verbatimProvisions,
      "",
      "**सारांश**",
      "",
      buildKharejCourtFeeSaransh(chunks),
    ].join("\n");

    return {
      stream: streamVerbatim(answer),
      sources: await sourcesForExpandedPanel(
        queryUsed,
        advocateSourcesForUi(chunks),
        chunks,
        ADVOCATE_UI_SOURCES_MAX
      ),
      retrievalMode: mode,
      analysis,
    };
  }

  const context = buildAdvocateContext(chunks);
  let mandate: string | undefined;
  if (conflict.mandate) mandate = conflict.mandate;
  if (isPratiuttarDeadlineQuery(queryUsed)) {
    const baseDafa = isPratiuttarAfterTamelDeadlineQuery(queryUsed)
      ? "दफा ११९"
      : "दफा १०१";
    const pratiuttarMandate = `TOPIC MANDATE — प्रतिउत्तर / deadline question:
The excerpts include the base filing rule AND extension/thamau provisions. In your **सारांश**, explain how ${baseDafa} (एक्काइस दिन), and when present दफा १६३, २२३, २२५, २२७ apply for extensions/thamau.
Statute text under **लागू प्रावधानहरू** is inserted automatically — cite दफा numbers in **सारांश** only.`;
    mandate = [mandate, pratiuttarMandate].filter(Boolean).join("\n\n");
  }

  let muddha = originalQuestion;
  let saransh =
    "उपरोक्त लागू प्रावधानहरू अनुसार विषयको व्याख्या गर्नुहोस्।";

  try {
    const promptCacheKey = buildAdvocatePromptCacheKey(chunks, bookScope, "advocate");
    const narrative = await completeChat(
      buildAdvocateNarrativeSystemPrompt(),
      buildAdvocateNarrativeUserPrompt(
        originalQuestion,
        analysis,
        context,
        { mandate }
      ),
      undefined,
      "narrative",
      { promptCacheKey }
    );
    ({ muddha, saransh } = parseAdvocateNarrative(narrative));
  } catch (error) {
    console.warn("Advocate narrative generation failed, using fallback:", error);
  }

  const answer = [
    "**मुद्दा**",
    "",
    muddha,
    "",
    "**लागू प्रावधानहरू**",
    "",
    verbatimProvisions,
    "",
    "**सारांश**",
    "",
    saransh,
  ].join("\n");

  return {
    stream: streamVerbatim(answer),
    sources: await sourcesForExpandedPanel(
      queryUsed,
      advocateSourcesForUi(chunks),
      chunks,
      ADVOCATE_UI_SOURCES_MAX
    ),
    retrievalMode: mode,
    analysis,
  };
}

const HINT_VECTOR_WEIGHT = 0.6;
const HINT_METADATA_WEIGHT = 0.4;
/** Minimum similarity floor for metadata-hint दफा chunks during RRF fusion. */
const METADATA_EXACT_DAFA_SIMILARITY = 0.35;

function applyMetadataExactDafaHintsToAnalysis(
  analysis: QueryAnalysis,
  metadataHint: import("./query-translate").QueryMetadataHint,
  hintScope: ParsedBookScope
): void {
  const act = primaryBookId(hintScope);
  analysis.sectionHints = (metadataHint.exactDafaGuess ?? []).map((dafa) => ({
    section: String(dafa),
    act,
  }));
  analysis.chapterHints = [];
  analysis.preferredAct = act;
}

async function fetchMetadataHintChunks(
  metadataHint: import("./query-translate").QueryMetadataHint | undefined,
  hintScope: ParsedBookScope,
  _queryUsed: string,
  excludeDafas: number[] = []
): Promise<MatchedChunk[]> {
  if (!metadataHint) return [];

  const excluded = new Set(excludeDafas.map((d) => toArabicDigits(String(d))));
  const sectionsToFetch: string[] = [];

  for (const dafa of metadataHint.exactDafaGuess ?? []) {
    const s = String(dafa);
    if (excluded.has(toArabicDigits(s))) continue;
    if (!sectionsToFetch.includes(s)) sectionsToFetch.push(s);
  }

  if (sectionsToFetch.length === 0) return [];

  const results = await retrieveScopedSectionsBatch(
    sectionsToFetch,
    primaryBookId(hintScope)
  );

  return results.filter((c) => filenameMatchesAnyBookScope(c.filename, hintScope));
}

/** One block per hinted दफा with competitive similarity for advocate RRF fusion. */
function prepareMetadataHintChunksForFusion(
  hintChunks: MatchedChunk[],
  vectorTopSimilarity: number
): MatchedChunk[] {
  const collapsed = collapseAdvocateSectionGroups(hintChunks);
  const floor = Math.max(vectorTopSimilarity, METADATA_EXACT_DAFA_SIMILARITY);
  return collapsed.map((chunk) => ({
    ...chunk,
    similarity: Math.max(chunk.similarity, floor),
  }));
}

/**
 * RRF scores are tiny (~0.01); restore hinted दफा to vector-competitive similarity
 * so they are not drowned out by other advocate paths scoring 0.9+.
 */
function boostFusedExactDafaHints(
  fused: MatchedChunk[],
  exactDafas: number[],
  vectorTopSimilarity: number
): MatchedChunk[] {
  if (exactDafas.length === 0) return fused;
  const hinted = new Set(exactDafas.map(String));
  const floor = Math.max(vectorTopSimilarity, METADATA_EXACT_DAFA_SIMILARITY);
  return fused
    .map((chunk) => {
      const root = chunk.section_label?.split(".")[0];
      if (root && hinted.has(root)) {
        return { ...chunk, similarity: Math.max(chunk.similarity, floor) };
      }
      return chunk;
    })
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * RRF fusion of regular vector/keyword retrieval with Gemini metadata-hint retrieval.
 * Both sources contribute to the final ranking — neither is trusted blindly.
 */
function fuseVectorAndHintChunks(
  vectorChunks: MatchedChunk[],
  hintChunks: MatchedChunk[]
): MatchedChunk[] {
  const fused = fuseRankedListsRRF(
    [vectorChunks, hintChunks],
    {
      weights: [HINT_VECTOR_WEIGHT, HINT_METADATA_WEIGHT],
      listNames: ["vector", "hint"],
    }
  );
  return fused;
}

export async function streamAnswer(
  queryUsed: string,
  options: {
    bookScope?: ParsedBookScope;
    answerMode?: AnswerMode;
    originalQuestion?: string;
    metadataHint?: import("./query-translate").QueryMetadataHint;
    searchKeywords?: string[];
    /** Temporary retry-only: root दफा numbers already shown to the user. */
    excludeDafas?: number[];
  } = {}
) {
  const bookScope = options.bookScope ?? "auto";
  const answerMode = options.answerMode ?? "quote";
  const originalQuestion = options.originalQuestion ?? queryUsed;
  const metadataHint = options.metadataHint;
  const searchKeywords = options.searchKeywords;
  const excludeDafas = options.excludeDafas ?? [];

  if (answerMode === "advocate") {
    const { stream, sources, retrievalMode, analysis } =
      await streamAdvocateAnswer(
        queryUsed,
        originalQuestion,
        bookScope,
        metadataHint,
        searchKeywords,
        excludeDafas
      );
    return {
      stream,
      sources,
      retrievalMode,
      chatMode: "advocate" as const,
      analysis,
    };
  }

  const structuredRef =
    extractStructuredLegalRef(originalQuestion) ??
    extractStructuredLegalRef(queryUsed);
  const isStructured =
    isStructuredLegalQuery(originalQuestion) ||
    isStructuredLegalQuery(queryUsed) ||
    Boolean(structuredRef.chunkId || structuredRef.upadafa || structuredRef.khanda);

  if (isStructured) {
    const metaChunks = await retrieveByStructuredRef(
      structuredRef,
      primaryBookId(bookScope)
    );
    if (metaChunks.length > 0) {
      const isSectionOnly =
        structuredRef.sectionDafa &&
        !structuredRef.chunkId &&
        !structuredRef.upadafa &&
        !structuredRef.khanda;

      const isHierarchicalSub =
        structuredRef.sectionDafa &&
        !structuredRef.chunkId &&
        (structuredRef.upadafa || structuredRef.khanda);

      let chunksToFormat = metaChunks;

      if (structuredRef.sectionDafa) {
        const onlyTargetSection = metaChunks.filter(
          (c) => c.section_label?.split(".")[0] === structuredRef.sectionDafa
        );
        if (onlyTargetSection.length > 0) chunksToFormat = onlyTargetSection;
      }

      if (
        isHierarchicalSub &&
        structuredRef.sectionDafa &&
        hierarchicalChunksNeedFullSection(chunksToFormat)
      ) {
        const full = await retrieveScopedSectionChunks(
          structuredRef.sectionDafa,
          primaryBookId(bookScope),
          queryUsed,
          200
        );
        if (full.length > chunksToFormat.length) chunksToFormat = full;
      }

      if (isHierarchicalSub && structuredRef.upadafa) {
        const targetUpadafa = structuredRef.upadafa;
        const exactUpadafa = chunksToFormat.filter((c) => {
          const upadafaLine = c.content.match(
            /उपदफा\s*:\s*([\d०-९]+)/
          );
          if (!upadafaLine) return false;
          return toArabicDigits(upadafaLine[1]) === targetUpadafa;
        });
        if (exactUpadafa.length > 0) chunksToFormat = exactUpadafa;
      }

      if (isHierarchicalSub && structuredRef.khanda) {
        const targetKhanda = normalizeKhandaToDevanagari(structuredRef.khanda);
        const exactKhanda = chunksToFormat.filter((c) => {
          const khandaLine = c.content.match(/खण्ड\s*:\s*([क-ह])/);
          return khandaLine?.[1] === targetKhanda;
        });
        if (exactKhanda.length > 0) {
          if (!structuredRef.upadafa && exactKhanda.length > 1) {
            const withUpadafa = exactKhanda.map((c) => {
              const m = c.content.match(/उपदफा\s*:\s*([\d०-९]+)/);
              return { chunk: c, upadafa: m ? parseInt(toArabicDigits(m[1]), 10) : 0 };
            });
            const minUpadafa = Math.min(...withUpadafa.map((x) => x.upadafa));
            chunksToFormat = withUpadafa
              .filter((x) => x.upadafa === minUpadafa)
              .map((x) => x.chunk);
          } else {
            chunksToFormat = exactKhanda;
          }
        }
      }

      const answer =
        isSectionOnly || isHierarchicalSub
          ? formatHierarchicalSectionAnswer(chunksToFormat)
          : formatVerbatimSectionAnswer(metaChunks);

      return {
        stream: streamVerbatim(answer),
        sources: await sourcesForExpandedPanel(queryUsed, chunksToFormat),
        retrievalMode: "keyword" as const,
        chatMode: "verbatim" as const,
      };
    }
  }

  if (isProvisionTitleQuery(originalQuestion) || isProvisionTitleQuery(queryUsed)) {
    const titleMatch = await retrieveByProvisionTitle(queryUsed, bookScope);
    if (titleMatch && titleMatch.chunks.length > 0) {
      const answer =
        titleMatch.kind === "chapter"
          ? formatChapterProvisionAnswer(titleMatch.chunks)
          : formatHierarchicalSectionAnswer(titleMatch.chunks);
      return {
        stream: streamVerbatim(answer),
        sources: await sourcesForExpandedPanel(queryUsed, titleMatch.chunks),
        retrievalMode: "keyword" as const,
        chatMode: "verbatim" as const,
      };
    }
  }

  const quoteTopicChunks = await enrichQuoteTopicChunks(
    queryUsed,
    originalQuestion,
    bookScope
  );
  if (quoteTopicChunks?.length) {
    const answer = formatHierarchicalSectionAnswer(quoteTopicChunks);
    return {
      stream: streamVerbatim(answer),
      sources: await sourcesForExpandedPanel(queryUsed, quoteTopicChunks),
      retrievalMode: "keyword" as const,
      chatMode: "verbatim" as const,
    };
  }

  const effectiveBookScope =
    bookScope === "auto" && metadataHint?.act
      ? (normalizeActToBookScope(metadataHint.act) ?? bookScope)
      : bookScope;

  const hintScope = metadataHint?.act
    ? (normalizeActToBookScope(metadataHint.act) ?? effectiveBookScope)
    : effectiveBookScope;

  const [vectorResult, hintChunks] = await Promise.all([
    retrieveChunks(queryUsed, undefined, effectiveBookScope),
    fetchMetadataHintChunks(metadataHint, hintScope, queryUsed, excludeDafas),
  ]);

  let { chunks } = vectorResult;
  const { mode } = vectorResult;

  if (hintChunks.length > 0) {
    chunks = fuseVectorAndHintChunks(chunks, hintChunks);
  }

  chunks = filterExcludedDafaChunks(chunks, excludeDafas);

  if (chunks.length === 0) {
    throw new Error(
      "No matching law sections found. Try different keywords like 'हत्या', 'चोरी', or 'सजाय'."
    );
  }

  const relatedPool = chunks;

  const chunkId =
    extractChunkIdFromQuery(queryUsed) ??
    extractChunkIdFromQuery(originalQuestion);
  if (chunkId) {
    const answer = formatVerbatimSectionAnswer(chunks);
    return {
      stream: streamVerbatim(answer),
      sources: await sourcesForExpandedPanel(queryUsed, chunks, relatedPool),
      retrievalMode: mode,
      chatMode: "verbatim" as const,
    };
  }

  const sectionNum =
    extractSectionFromQuery(queryUsed) ??
    extractSectionFromQuery(originalQuestion);
  if (sectionNum) {
    let sectionChunks = chunks;
    if (targetBookIds(bookScope)) {
      sectionChunks = sectionChunks.filter((c) =>
        filenameMatchesAnyBookScope(c.filename, bookScope)
      );
    } else if (bookScope && bookScope !== "auto" && !Array.isArray(bookScope)) {
      sectionChunks = sectionChunks.filter((c) =>
        filenameMatchesScope(c.filename, bookScope)
      );
    } else {
      const bookFilter = resolveBookFilter(bookScope, queryUsed);
      if (bookFilter) {
        sectionChunks = sectionChunks.filter((c) => bookFilter.test(c.filename));
      }
    }

    const exactMatch = sectionChunks.filter(
      (c) => c.section_label?.split(".")[0] === sectionNum
    );
    if (exactMatch.length > 0) {
      sectionChunks = exactMatch;
    }

    const isIndexedHierarchy = sectionChunks.some((c) =>
      /प्रकार\s*:/.test(c.content)
    );

    let toFormat = sectionChunks;
    if (!isIndexedHierarchy) {
      const merged = mergeSectionChunks(sectionChunks, sectionNum);
      toFormat = merged.length > 0 ? merged : sectionChunks;
    }

    if (toFormat.length > 0) {
      const answer =
        isIndexedHierarchy && toFormat.length > 1
          ? formatHierarchicalSectionAnswer(toFormat)
          : formatVerbatimSectionAnswer(toFormat);
      return {
        stream: streamVerbatim(answer),
        sources: await sourcesForExpandedPanel(
          queryUsed,
          toFormat,
          relatedPool
        ),
        retrievalMode: mode,
        chatMode: "verbatim" as const,
      };
    }
  }

  const context = buildContext(chunks);
  const promptCacheKey = buildAdvocatePromptCacheKey(chunks, bookScope, "quote");
  const { stream, chatMode } = await streamChat({
    question: originalQuestion,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(originalQuestion, context),
    chunks,
    promptCacheKey,
  });

  return {
    stream,
    sources: await sourcesForExpandedPanel(queryUsed, chunks, relatedPool),
    retrievalMode: mode,
    chatMode,
  };
}
