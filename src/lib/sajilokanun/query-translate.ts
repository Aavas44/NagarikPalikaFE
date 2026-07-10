import { normalizeForEmbedding } from "./embedding-text";
import { finalizeNepaliQuestion, latinCount } from "./devanagari-text";
import { toArabicDigits } from "./nepali-digits";
import {
  geminiQueryPreprocessAvailable,
  preprocessLegalQueryWithGemini,
} from "./query-preprocess-gemini";
import { needsGeminiPreprocess } from "./query-latin-detect";
import { isStructuredLegalQuery } from "./structured-legal-query";
import { getCachedNormalize, setCachedNormalize } from "./query-normalize-cache";
import type { BookScope } from "./lawbooks";
import {
  resolveDafaNumbersFromMatchingNames,
} from "./dafa-name-taxonomy";

export type QueryMetadataHint = {
  act?: string;
  /** 2–3 verbatim दफा title lines from indexed taxonomy. */
  matchingDafaNames?: string[];
  /** Root दफा numbers — from matchingDafaNames or Gemini exact_dafa_guess. */
  exactDafaGuess?: number[];
};

export type NormalizedQuery = {
  originalQuery: string;
  queryUsed: string;
  /** Gemini legal terms for keyword/FTS retrieval (separate from vector query). */
  searchKeywords?: string[];
  /** Gemini converted Roman/English to Devanagari. */
  translated: boolean;
  /** Final query differs from what the user typed (translation and/or cleanup). */
  rewritten: boolean;
  /** Gemini's metadata prediction for hard filtering. */
  metadataHint?: QueryMetadataHint;
};

export class QueryNormalizeError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "QueryNormalizeError";
    this.status = status;
  }
}

function unwrapJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

type GeminiNormalizeResponse = {
  legal_analysis?: string;
  optimized_query?: string;
  search_keywords?: string[] | string;
  queries?: string[];
  act?: string;
  exact_dafa_guess?: number | string | number[] | null;
  exactDafaGuess?: number | string | number[] | null;
  matching_dafa_names?: string[] | string | null;
  matchingDafaNames?: string[] | string | null;
};

function parseSearchKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/** Split legacy combined optimized_query (question + comma-separated terms). */
export function splitOptimizedQuery(text: string): {
  question: string;
  keywords: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) return { question: "", keywords: [] };

  const match = trimmed.match(/^(.+?[?।])\s+(.+)$/);
  if (!match) return { question: trimmed, keywords: [] };

  const tail = match[2].trim();
  if (!tail.includes(",")) return { question: trimmed, keywords: [] };

  const keywords = tail
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (keywords.length === 0) return { question: trimmed, keywords: [] };

  return { question: match[1].trim(), keywords };
}

function parseExactDafaGuess(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(toArabicDigits(value.trim()));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseMatchingDafaNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

/** Stable /api/normalize-query metadataHint shape. */
export function finalizeMetadataHint(
  metadata: QueryMetadataHint
): QueryMetadataHint | undefined {
  const act = metadata.act?.trim();
  const matchingDafaNames = metadata.matchingDafaNames?.length
    ? metadata.matchingDafaNames
    : undefined;
  const exactDafaGuess = metadata.exactDafaGuess?.length
    ? metadata.exactDafaGuess
    : undefined;
  if (!act) return undefined;

  const hint: QueryMetadataHint = { act };
  if (matchingDafaNames?.length) hint.matchingDafaNames = matchingDafaNames;
  if (exactDafaGuess?.length) hint.exactDafaGuess = exactDafaGuess;
  return hint;
}

function exactDafaGuessFromGemini(parsed: GeminiNormalizeResponse): number[] {
  return parseExactDafaGuessList(
    parsed.exact_dafa_guess ?? parsed.exactDafaGuess
  );
}

/** Parse exact_dafa_guess — single number, array, or legacy scalar → 1–2 unique दफा. */
export function parseExactDafaGuessList(value: unknown): number[] {
  if (Array.isArray(value)) {
    const nums = value
      .map(parseExactDafaGuess)
      .filter((n): n is number => n != null);
    return [...new Set(nums)].slice(0, 2);
  }
  const single = parseExactDafaGuess(value);
  return single != null ? [single] : [];
}

export function exactDafaGuessList(
  hint?: QueryMetadataHint | null
): number[] {
  return hint?.exactDafaGuess?.length ? hint.exactDafaGuess : [];
}

/** Parse Gemini JSON response — extracts optimized_query, search keywords, and metadata. */
export function parseGeminiResponse(raw: string): {
  query: string;
  searchKeywords: string[];
  metadata: QueryMetadataHint;
  legalAnalysis?: string;
} {
  const payload = unwrapJsonPayload(raw);

  try {
    const parsed = JSON.parse(payload) as GeminiNormalizeResponse;

    const rawQuery =
      (typeof parsed.optimized_query === "string" && parsed.optimized_query.trim()) ||
      (Array.isArray(parsed.queries) && parsed.queries[0]?.trim()) ||
      "";

    const explicitKeywords = parseSearchKeywords(parsed.search_keywords);
    const split = splitOptimizedQuery(rawQuery);
    const query = split.keywords.length > 0 ? split.question : rawQuery;
    const searchKeywords =
      explicitKeywords.length > 0 ? explicitKeywords : split.keywords;

    const metadata: QueryMetadataHint = {};
    if (parsed.act && typeof parsed.act === "string") {
      metadata.act = parsed.act;
    }
    const matchingNames = parseMatchingDafaNames(
      parsed.matching_dafa_names ?? parsed.matchingDafaNames
    );
    if (matchingNames.length > 0) {
      metadata.matchingDafaNames = matchingNames;
    }

    const fromNames = resolveDafaNumbersFromMatchingNames(
      matchingNames,
      metadata.act
    );
    if (fromNames.length >= 2) {
      metadata.exactDafaGuess = fromNames.slice(0, 2);
    } else {
      const fromGemini = exactDafaGuessFromGemini(parsed);
      const merged = [...new Set([...fromNames, ...fromGemini])].slice(0, 2);
      if (merged.length > 0) {
        metadata.exactDafaGuess = merged;
      } else if (
        parsed.exact_dafa_guess != null ||
        parsed.exactDafaGuess != null
      ) {
        console.warn(
          "[HandyLaw query translate] Gemini returned exact_dafa_guess but parsing yielded no numbers:",
          parsed.exact_dafa_guess ?? parsed.exactDafaGuess
        );
      }
    }

    const legalAnalysis =
      typeof parsed.legal_analysis === "string" ? parsed.legal_analysis : undefined;

    return { query, searchKeywords, metadata, legalAnalysis };
  } catch {
    // fall through
  }

  const plain = payload.replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();
  const split = splitOptimizedQuery(plain);
  return {
    query: split.question || plain,
    searchKeywords: split.keywords,
    metadata: {},
  };
}

/** @deprecated Use parseGeminiResponse */
export function parsePreprocessedQueries(raw: string): string[] {
  const { query } = parseGeminiResponse(raw);
  return query ? [query] : [];
}

/** True when the query already has enough Devanagari to search as-is. */
export function isDevanagariNepali(text: string): boolean {
  return (text.match(/[\u0900-\u097F]/g) ?? []).length >= 4;
}

/** English or Romanized Nepali — needs conversion to Devanagari. */
export function needsLatinToNepali(text: string): boolean {
  if (isDevanagariNepali(text)) return false;
  return (text.match(/[A-Za-z]/g) ?? []).length >= 3;
}

/** English, Romanized Nepali, or mixed Devanagari + Latin — needs normalization. */
export function needsQueryRewrite(text: string): boolean {
  return needsGeminiPreprocess(text);
}

/** @deprecated Use needsLatinToNepali */
export function isPrimarilyEnglish(text: string): boolean {
  return needsLatinToNepali(text);
}

export { needsGeminiPreprocess, hasLatinLetters } from "./query-latin-detect";

export type NormalizeQueryOptions = {
  /** Scope metadata prediction to this book (not "auto"). */
  book?: BookScope;
};

/**
 * Send user query to Gemini for translation (if needed) and metadata prediction (always).
 * @throws QueryNormalizeError when Gemini unavailable and Latin text present.
 */
export async function normalizeQueryWithGemini(
  question: string,
  options: NormalizeQueryOptions = {}
): Promise<NormalizedQuery> {
  const bookScope = options.book && options.book !== "auto" ? options.book : undefined;
  const originalQuery = question.trim();
  if (!originalQuery) {
    return { originalQuery: "", queryUsed: "", translated: false, rewritten: false };
  }

  const needsTranslation = needsGeminiPreprocess(originalQuery);

  const isExplicitDafaLookup =
    /^(?:dafa|sec)_[\w\u0900-\u097F]+$/i.test(originalQuery) ||
    /(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*[\d०-९]+/i.test(originalQuery);

  if (isExplicitDafaLookup && !needsTranslation) {
    return {
      originalQuery,
      queryUsed: originalQuery,
      translated: false,
      rewritten: false,
    };
  }

  if (!geminiQueryPreprocessAvailable()) {
    throw new QueryNormalizeError(
      "GEMINI_API_KEY is required for query normalization.",
      503
    );
  }

  const cached = getCachedNormalize(originalQuery, bookScope);
  if (cached) {
    if (!cached.searchKeywords?.length && cached.queryUsed) {
      const split = splitOptimizedQuery(cached.queryUsed);
      if (split.keywords.length > 0) {
        const migrated: NormalizedQuery = {
          ...cached,
          queryUsed: normalizeForEmbedding(split.question),
          searchKeywords: split.keywords,
          rewritten: true,
          metadataHint: finalizeMetadataHint(cached.metadataHint ?? {}),
        };
        console.log(
          "[HandyLaw query translate]",
          JSON.stringify({
            originalQuery,
            bookScope: bookScope ?? "auto",
            cached: true,
            migratedSplitKeywords: true,
            searchKeywords: split.keywords,
          })
        );
        return migrated;
      }
    }
    console.log(
      "[HandyLaw query translate]",
      JSON.stringify({
        originalQuery,
        bookScope: bookScope ?? "auto",
        cached: true,
        metadataHint: cached.metadataHint,
      })
    );
    return {
      ...cached,
      metadataHint: finalizeMetadataHint(cached.metadataHint ?? {}),
    };
  }

  let raw: string;
  try {
    raw = await preprocessLegalQueryWithGemini({
      query: originalQuery,
      needsTranslation,
      vocabularyHints: [],
      bookScope,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini query normalization failed";
    console.error("[HandyLaw query translate] Gemini normalize failed:", message);
    throw new QueryNormalizeError(message, needsTranslation ? 503 : 502);
  }

  const { query: geminiQuery, searchKeywords: geminiKeywords, metadata } =
    parseGeminiResponse(raw);
  const split = splitOptimizedQuery(geminiQuery || originalQuery);
  const questionText = finalizeNepaliQuestion(
    split.keywords.length > 0 ? split.question : geminiQuery || originalQuery
  );
  const searchKeywords =
    geminiKeywords.length > 0 ? geminiKeywords : split.keywords;

  if (needsTranslation) {
    if (!questionText || !isDevanagariNepali(questionText)) {
      throw new QueryNormalizeError(
        "Gemini returned an invalid normalization. Please try again.",
        502
      );
    }
    if (latinCount(questionText) > 0) {
      throw new QueryNormalizeError(
        "Query still contains Roman/English after normalization. Please try again.",
        502
      );
    }
  }

  const queryUsed = normalizeForEmbedding(
    isDevanagariNepali(questionText)
      ? questionText
      : needsTranslation
        ? questionText
        : originalQuery
  );

  const translated = needsTranslation && queryUsed !== normalizeForEmbedding(originalQuery);

  console.log(
    "[HandyLaw query translate]",
    JSON.stringify(
      {
        originalQuery,
        queryUsed,
        searchKeywords,
        translated,
        rewritten: queryUsed !== normalizeForEmbedding(originalQuery),
        provider: "gemini",
        bookScope: bookScope ?? "auto",
        metadataHint: metadata,
      },
      null,
      2
    )
  );

  const metadataHint = finalizeMetadataHint(metadata);
  if (metadata.act && !metadata.exactDafaGuess?.length) {
    console.warn(
      "[HandyLaw query translate] Gemini returned act without exactDafaGuess:",
      { act: metadata.act, originalQuery }
    );
  }

  const result: NormalizedQuery = {
    originalQuery,
    queryUsed,
    searchKeywords: searchKeywords.length > 0 ? searchKeywords : undefined,
    translated,
    rewritten: queryUsed !== normalizeForEmbedding(originalQuery),
    metadataHint,
  };

  setCachedNormalize(originalQuery, result, bookScope);
  return result;
}

/**
 * For /chat when message is already Devanagari (normalized client-side or native Nepali).
 */
export async function normalizeQueryForRetrieval(
  question: string
): Promise<NormalizedQuery> {
  const originalQuery = question.trim();
  if (!originalQuery) {
    return { originalQuery: "", queryUsed: "", translated: false, rewritten: false };
  }

  if (needsGeminiPreprocess(originalQuery)) {
    throw new QueryNormalizeError(
      "Query contains Roman/English text. Call POST /api/normalize-query first.",
      400
    );
  }

  const structuredLegal = isStructuredLegalQuery(originalQuery);
  const queryUsed = structuredLegal
    ? originalQuery
    : normalizeForEmbedding(originalQuery);

  console.log(
    "[HandyLaw query translate]",
    JSON.stringify({
      originalQuery,
      queryUsed,
      translated: false,
      rewritten: false,
      skipped: "already-devanagari",
    })
  );

  return {
    originalQuery,
    queryUsed,
    translated: false,
    rewritten: false,
  };
}
