import { getGemini, getGeminiFallback, extractGeminiResponseText } from "./gemini";
import { getOpenAI, resolveOpenAiTemperature } from "./openai";
import {
  fromGeminiUsage,
  fromOpenAiUsage,
  getOpenAiCachedTokens,
  type UsageOperation,
} from "./token-usage";
import { bookScopeToNormalizeAct, bookTitleForScope, type BookScope } from "./lawbooks";
import {
  type NormalizePromptBundle,
  openAiNormalizeCacheParams,
  resolveGeminiContextCache,
} from "./normalize-prompt-cache";
import {
  buildNormalizeSystemInstruction,
  buildNormalizeUserPrompt,
  normalizeSemanticCacheKey,
  type NormalizeActId,
} from "./query-normalize-prompt";
import type { GoogleGenAI } from "@google/genai";

const NON_GEMINI_MODEL = /^(gpt-|o[0-9](?:-|$)|claude-|text-davinci)/i;

/** Default when QUERY_NORMALIZE_MODEL unset. */
const QUERY_NORMALIZE_DEFAULT = "gemini-2.5-flash-lite";

/** Fallback when primary Gemini model fails (503, 429 quota, billing, etc.). */
const QUERY_NORMALIZE_FALLBACK_DEFAULT = "gpt-5-nano";

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
  if (configured) {
    return configured;
  }
  return QUERY_NORMALIZE_FALLBACK_DEFAULT;
}

export function isOpenAiNormalizeModel(model: string): boolean {
  return NON_GEMINI_MODEL.test(model);
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

function shouldUseNormalizeFallback(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number" && [401, 403, 429, 500, 502, 503, 504].includes(status)) {
      return true;
    }
    if (status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED") return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/Empty Gemini query preprocess response/.test(message)) return true;

  return (
    /"code"\s*:\s*(401|403|429|500|502|503|504)/.test(message) ||
    /"status"\s*:\s*"(UNAVAILABLE|RESOURCE_EXHAUSTED)"/i.test(message) ||
    /high demand|prepayment credits|depleted|billing/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|fetch failed/i.test(message) ||
    /\b503\b/.test(message) ||
    /\b429\b/.test(message)
  );
}

type NormalizeGenerateParams = {
  model: string;
  userPrompt: string;
  systemPrompt: string;
  bundle: NormalizePromptBundle;
  cachedContent?: string;
  thinkingBudget: number;
  bookScope?: BookScope;
  needsTranslation: boolean;
  usedFallback?: boolean;
  apiKeyLabel?: string;
  operation: UsageOperation;
};

function geminiNormalizeClients(): Array<{ label: string; client: GoogleGenAI }> {
  const clients: Array<{ label: string; client: GoogleGenAI }> = [];
  if (process.env.GEMINI_API_KEY?.trim()) {
    clients.push({ label: "primary", client: getGemini() });
  }
  const fallback = getGeminiFallback();
  if (fallback && process.env.GEMINI_API_KEY_FALLBACK?.trim()) {
    clients.push({ label: "fallback-key", client: fallback });
  }
  return clients;
}

async function generateNormalizeWithGeminiClient(
  client: GoogleGenAI,
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
    apiKeyLabel,
    operation,
  } = params;

  const response = await client.models.generateContent({
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
  fromGeminiUsage(usage, {
    operation,
    provider: "gemini",
    model,
  });
  console.log(
    "[HandyLaw query preprocess gemini]",
    JSON.stringify({
      model,
      operation,
      apiKey: apiKeyLabel ?? "primary",
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

/** Try GEMINI_API_KEY, then GEMINI_API_KEY_FALLBACK, same model. */
async function generateNormalizeWithGeminiKeys(
  params: NormalizeGenerateParams
): Promise<string> {
  const clients = geminiNormalizeClients();
  if (clients.length === 0) {
    throw new Error("GEMINI_API_KEY is required for query normalization.");
  }

  let lastError: unknown;
  for (let i = 0; i < clients.length; i++) {
    const { label, client } = clients[i]!;
    try {
      return await generateNormalizeWithGeminiClient(client, {
        ...params,
        // Only the first key may reuse a primary-created context cache name.
        cachedContent: i === 0 ? params.cachedContent : undefined,
        usedFallback: i > 0 ? true : params.usedFallback,
        apiKeyLabel: label,
      });
    } catch (error) {
      lastError = error;
      if (!shouldUseNormalizeFallback(error) || i === clients.length - 1) {
        break;
      }
      console.warn(
        "[HandyLaw query preprocess gemini]",
        JSON.stringify({
          primaryModel: params.model,
          apiKey: label,
          nextApiKey: clients[i + 1]?.label,
          operation: params.operation,
          reason: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Gemini normalize failed"));
}

async function generateNormalizeWithOpenAI(
  params: Omit<NormalizeGenerateParams, "cachedContent" | "thinkingBudget">
): Promise<string> {
  const {
    model,
    userPrompt,
    systemPrompt,
    bundle,
    bookScope,
    needsTranslation,
    usedFallback,
    operation,
  } = params;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for OpenAI query normalization fallback.");
  }

  const temperature = resolveOpenAiTemperature(model);
  const cacheParams = openAiNormalizeCacheParams(bundle, model);
  const response = await getOpenAI().chat.completions.create({
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    response_format: { type: "json_object" },
    ...cacheParams,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty OpenAI query preprocess response");
  }

  const { cachedTokens, cacheWriteTokens } = getOpenAiCachedTokens(response.usage);
  fromOpenAiUsage(response.usage, {
    operation,
    provider: "openai",
    model,
  });

  console.log(
    "[HandyLaw query preprocess openai]",
    JSON.stringify({
      model,
      operation,
      bookScope: bookScope ?? "auto",
      needsTranslation,
      fallback: usedFallback ?? false,
      promptCacheKey: bundle.semanticKey,
      openAiCachedTokens: cachedTokens,
      openAiCacheWriteTokens: cacheWriteTokens,
      raw: text.slice(0, 400),
    })
  );

  return text;
}

type GenerateContext = {
  model: string;
  fallbackModel: string;
  thinkingBudget: number;
  bookScope?: BookScope;
  needsTranslation: boolean;
  openAiFallback: boolean;
  geminiAvailable: boolean;
};

async function generateWithFallback(
  ctx: GenerateContext,
  params: Omit<
    NormalizeGenerateParams,
    "model" | "usedFallback" | "thinkingBudget" | "apiKeyLabel"
  >
): Promise<string> {
  const {
    model,
    fallbackModel,
    thinkingBudget,
    openAiFallback,
    geminiAvailable,
  } = ctx;

  const tryOpenAi = () =>
    generateNormalizeWithOpenAI({
      ...params,
      model: fallbackModel,
      usedFallback: geminiAvailable,
    });

  if (!geminiAvailable) {
    if (openAiFallback) return tryOpenAi();
    throw new Error("GEMINI_API_KEY is required for query normalization.");
  }

  try {
    // 1) GEMINI_API_KEY  2) GEMINI_API_KEY_FALLBACK  — same Gemini model
    return await generateNormalizeWithGeminiKeys({
      ...params,
      model,
      thinkingBudget,
    });
  } catch (error) {
    if (!shouldUseNormalizeFallback(error) || !openAiFallback) {
      throw error;
    }

    console.warn(
      "[HandyLaw query preprocess gemini]",
      JSON.stringify({
        primaryModel: model,
        fallbackModel,
        operation: params.operation,
        reason: error instanceof Error ? error.message : String(error),
      })
    );

    // 3) OpenAI last resort
    return tryOpenAi();
  }
}

async function runNormalizeStep(
  ctx: GenerateContext,
  bundle: NormalizePromptBundle,
  userPrompt: string,
  operation: UsageOperation,
  bookScope?: BookScope
): Promise<string> {
  const cachedContent = await resolveGeminiContextCache(bundle, ctx.model);

  return generateWithFallback(ctx, {
    userPrompt,
    systemPrompt: bundle.systemPrompt,
    bundle,
    cachedContent: cachedContent ?? undefined,
    bookScope,
    needsTranslation: ctx.needsTranslation,
    operation,
  });
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

  const bundle: NormalizePromptBundle = {
    semanticKey: normalizeSemanticCacheKey({ bookAct, bookScope }),
    systemPrompt: buildNormalizeSystemInstruction(bookAct, bookScope),
    scopeLabel: bookAct ?? "auto",
  };

  const userPrompt = appendVocabularyHints(
    buildNormalizeUserPrompt(query, bookTitle),
    vocabularyHints
  );

  const thinkingBudget = Number(process.env.QUERY_NORMALIZE_THINKING_BUDGET ?? 0);
  const openAiFallback =
    isOpenAiNormalizeModel(fallbackModel) && Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiAvailable =
    Boolean(process.env.GEMINI_API_KEY?.trim()) ||
    Boolean(process.env.GEMINI_API_KEY_FALLBACK?.trim());

  return runNormalizeStep(
    {
      model,
      fallbackModel,
      thinkingBudget,
      bookScope,
      needsTranslation,
      openAiFallback,
      geminiAvailable,
    },
    bundle,
    userPrompt,
    "normalize",
    bookScope
  );
}

export function geminiQueryPreprocessAvailable(): boolean {
  return (
    Boolean(process.env.GEMINI_API_KEY?.trim()) ||
    Boolean(process.env.GEMINI_API_KEY_FALLBACK?.trim())
  );
}

/** True when Gemini or OpenAI fallback can run query normalization. */
export function queryNormalizeAvailable(): boolean {
  if (geminiQueryPreprocessAvailable()) return true;
  return (
    isOpenAiNormalizeModel(QUERY_NORMALIZE_FALLBACK_MODEL) &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}
