import { getGemini, extractGeminiResponseText } from "./gemini";
import { bookScopeToNormalizeAct, bookTitleForScope, type BookScope } from "./lawbooks";
import {
  buildNormalizeSystemInstruction,
  buildNormalizeUserPrompt,
  normalizePromptCacheKey,
  type NormalizeActId,
} from "./query-normalize-prompt";

const NON_GEMINI_MODEL = /^(gpt-|o[0-9](?:-|$)|claude-|text-davinci)/i;

/** Default when QUERY_NORMALIZE_MODEL unset. */
const QUERY_NORMALIZE_DEFAULT = "gemini-2.5-flash-lite";

/** Fallback when primary normalize model returns 503 / UNAVAILABLE. */
const QUERY_NORMALIZE_FALLBACK_DEFAULT = "gemini-2.5-flash";

/** Gemini model for query preprocessing — never pass OpenAI model names to Gemini API. */
export function resolveQueryNormalizeModel(): string {
  const configured = process.env.QUERY_NORMALIZE_MODEL?.trim();
  const geminiDefault = process.env.GEMINI_CHAT_MODEL ?? QUERY_NORMALIZE_DEFAULT;

  if (configured && !NON_GEMINI_MODEL.test(configured)) {
    return configured;
  }

  if (configured && NON_GEMINI_MODEL.test(configured)) {
    console.warn(
      "[HandyLaw query preprocess] QUERY_NORMALIZE_MODEL is not a Gemini model; using",
      geminiDefault
    );
  }

  return geminiDefault;
}

export function resolveQueryNormalizeFallbackModel(): string {
  const configured = process.env.QUERY_NORMALIZE_FALLBACK_MODEL?.trim();
  if (configured && !NON_GEMINI_MODEL.test(configured)) {
    return configured;
  }
  return QUERY_NORMALIZE_FALLBACK_DEFAULT;
}

export const QUERY_NORMALIZE_MODEL = resolveQueryNormalizeModel();
export const QUERY_NORMALIZE_FALLBACK_MODEL = resolveQueryNormalizeFallbackModel();

export type PreprocessLegalQueryOptions = {
  query: string;
  needsTranslation: boolean;
  vocabularyHints: string[];
  /** When set, lock metadata to this book. */
  bookScope?: BookScope;
};

type ContextCacheEntry = {
  name: string;
  expiresAt: number;
};

const contextCacheByKey = new Map<string, ContextCacheEntry>();

function contextCacheEnabled(): boolean {
  const flag = process.env.QUERY_NORMALIZE_USE_CONTEXT_CACHE?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

async function getOrCreateContextCache(
  model: string,
  cacheKey: string,
  systemInstruction: string,
  scopeLabel: string
): Promise<string | null> {
  if (!contextCacheEnabled()) return null;

  const existing = contextCacheByKey.get(cacheKey);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.name;
  }

  const ttlSec = Number(process.env.QUERY_NORMALIZE_CONTEXT_CACHE_TTL_SEC ?? 86400);

  try {
    const response = await getGemini().caches.create({
      model,
      config: {
        systemInstruction,
        displayName: `handyLaw-normalize-${scopeLabel}-${cacheKey}`,
        ttl: `${ttlSec}s`,
      },
    });

    if (!response.name) return null;

    contextCacheByKey.set(cacheKey, {
      name: response.name,
      expiresAt: Date.now() + (ttlSec - 3600) * 1000,
    });

    console.log(
      "[HandyLaw query preprocess gemini]",
      JSON.stringify({
        contextCacheCreated: true,
        scope: scopeLabel,
        model,
        key: cacheKey,
        promptChars: systemInstruction.length,
      })
    );

    return response.name;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[HandyLaw query preprocess gemini] ${scopeLabel} context cache unavailable, using dynamic prompt:`,
      message
    );
    return null;
  }
}

function appendVocabularyHints(userPrompt: string, vocabularyHints: string[]): string {
  if (vocabularyHints.length === 0) return userPrompt;

  return `Indexed statute terms (use these exact spellings when they match the user's intent):
${vocabularyHints.map((t) => `- ${t}`).join("\n")}

${userPrompt}`;
}

function resolveBookAct(bookScope?: BookScope): NormalizeActId | null {
  if (!bookScope || bookScope === "auto") return null;
  return bookScopeToNormalizeAct(bookScope);
}

function isGeminiUnavailableError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (status === 503 || status === "UNAVAILABLE") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /"code"\s*:\s*503/.test(message) ||
    /"status"\s*:\s*"UNAVAILABLE"/i.test(message) ||
    /high demand/i.test(message) ||
    /\b503\b/.test(message)
  );
}

function buildSystemPrompt(
  bookScope: BookScope | undefined,
  vocabularyHints: string[]
): string {
  const bookAct = resolveBookAct(bookScope);
  const base = buildNormalizeSystemInstruction(bookAct, bookScope);
  if (vocabularyHints.length === 0) return base;

  return `${base}

Indexed statute terms (use these exact spellings when they match the user's intent):
${vocabularyHints.map((t) => `- ${t}`).join("\n")}`;
}

type NormalizeGenerateParams = {
  model: string;
  userPrompt: string;
  systemPrompt: string;
  cachedContent?: string;
  thinkingBudget: number;
  bookScope?: BookScope;
  needsTranslation: boolean;
  usedFallback?: boolean;
};

async function generateNormalizeWithModel(
  params: NormalizeGenerateParams
): Promise<string> {
  const {
    model,
    userPrompt,
    systemPrompt,
    cachedContent,
    thinkingBudget,
    bookScope,
    needsTranslation,
    usedFallback,
  } = params;

  const response = await getGemini().models.generateContent({
    model,
    contents: userPrompt,
    config: {
      ...(cachedContent && !usedFallback
        ? { cachedContent }
        : { systemInstruction: systemPrompt }),
      responseMimeType: "application/json",
      temperature: 0,
      thinkingConfig: thinkingBudget > 0 ? { thinkingBudget } : undefined,
    },
  });

  const text = extractGeminiResponseText(response);
  if (!text) {
    throw new Error("Empty Gemini query preprocess response");
  }

  const usage = response.usageMetadata;
  console.log(
    "[HandyLaw query preprocess gemini]",
    JSON.stringify({
      model,
      bookScope: bookScope ?? "auto",
      cachedContent: Boolean(cachedContent) && !usedFallback,
      needsTranslation,
      fallback: usedFallback ?? false,
      cachedTokenCount: usage?.cachedContentTokenCount ?? 0,
      promptTokenCount: usage?.promptTokenCount ?? 0,
      raw: text.slice(0, 400),
    })
  );

  return text;
}

/** Normalize user input via Gemini with optional book lock and context caching. */
export async function preprocessLegalQueryWithGemini(
  options: PreprocessLegalQueryOptions
): Promise<string> {
  const { query, needsTranslation, vocabularyHints, bookScope } = options;
  const model = QUERY_NORMALIZE_MODEL;
  const fallbackModel = QUERY_NORMALIZE_FALLBACK_MODEL;
  const bookAct = resolveBookAct(bookScope);
  const bookTitle = bookScope && bookScope !== "auto" ? bookTitleForScope(bookScope) : null;
  const systemPrompt = buildSystemPrompt(bookScope, vocabularyHints);

  const cacheKey = normalizePromptCacheKey(model, bookAct, bookScope);
  const cachedContent = await getOrCreateContextCache(
    model,
    cacheKey,
    systemPrompt,
    bookAct ?? "auto"
  );

  const userPrompt = cachedContent
    ? appendVocabularyHints(buildNormalizeUserPrompt(query, bookTitle), vocabularyHints)
    : buildNormalizeUserPrompt(query, bookTitle);

  const thinkingBudget = Number(process.env.QUERY_NORMALIZE_THINKING_BUDGET ?? 0);

  const generateParams: Omit<NormalizeGenerateParams, "model" | "usedFallback"> = {
    userPrompt,
    systemPrompt,
    cachedContent: cachedContent ?? undefined,
    thinkingBudget,
    bookScope,
    needsTranslation,
  };

  try {
    return await generateNormalizeWithModel({ ...generateParams, model });
  } catch (error) {
    if (!isGeminiUnavailableError(error) || model === fallbackModel) {
      throw error;
    }

    console.warn(
      "[HandyLaw query preprocess gemini]",
      JSON.stringify({
        primaryModel: model,
        fallbackModel,
        reason: error instanceof Error ? error.message : String(error),
      })
    );

    return await generateNormalizeWithModel({
      ...generateParams,
      model: fallbackModel,
      cachedContent: undefined,
      usedFallback: true,
    });
  }
}

export function geminiQueryPreprocessAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
