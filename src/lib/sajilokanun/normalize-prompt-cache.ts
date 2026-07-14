import { getGemini } from "./gemini";
import { NORMALIZE_PROMPT_VERSION } from "./query-normalize-prompt";

export type NormalizePromptBundle = {
  semanticKey: string;
  systemPrompt: string;
  scopeLabel: string;
};

type ContextCacheEntry = {
  name: string;
  expiresAt: number;
};

const contextCacheByKey = new Map<string, ContextCacheEntry>();

/** Skip Gemini generate attempts for this process after billing/quota 429. */
let geminiDepletedUntil = 0;

export function contextCacheEnabled(): boolean {
  const flag = process.env.QUERY_NORMALIZE_USE_CONTEXT_CACHE?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

export function isGeminiDepleted(): boolean {
  return Date.now() < geminiDepletedUntil;
}

function markGeminiDepleted(error: unknown) {
  if (!isGeminiQuotaError(error)) return;
  const ttlMs = Number(process.env.QUERY_NORMALIZE_GEMINI_DEPLETED_TTL_MS ?? 300_000);
  geminiDepletedUntil = Date.now() + ttlMs;
}

export function isGeminiQuotaError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (status === 429 || status === "RESOURCE_EXHAUSTED") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /"code"\s*:\s*429/.test(message) ||
    /"status"\s*:\s*"RESOURCE_EXHAUSTED"/i.test(message) ||
    /prepayment credits|depleted|billing/i.test(message)
  );
}

export function openAiPromptCacheParams(
  promptCacheKey: string,
  model: string
): { prompt_cache_key: string; prompt_cache_retention?: "24h" } {
  const params: { prompt_cache_key: string; prompt_cache_retention?: "24h" } = {
    prompt_cache_key: promptCacheKey,
  };
  if (/^gpt-(4\.1|5)/i.test(model)) {
    params.prompt_cache_retention = "24h";
  }
  return params;
}

export function openAiNormalizeCacheParams(
  bundle: NormalizePromptBundle,
  model: string
): { prompt_cache_key: string; prompt_cache_retention?: "24h" } {
  return openAiPromptCacheParams(bundle.semanticKey, model);
}

export async function resolveGeminiContextCache(
  bundle: NormalizePromptBundle,
  geminiModel: string
): Promise<string | null> {
  if (!contextCacheEnabled()) return null;
  if (!process.env.GEMINI_API_KEY?.trim()) return null;
  if (isGeminiDepleted()) return null;

  const existing = contextCacheByKey.get(bundle.semanticKey);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.name;
  }

  const ttlSec = Number(process.env.QUERY_NORMALIZE_CONTEXT_CACHE_TTL_SEC ?? 86400);

  try {
    const response = await getGemini().caches.create({
      model: geminiModel,
      config: {
        systemInstruction: bundle.systemPrompt,
        displayName: `handyLaw-normalize-${bundle.scopeLabel}-${bundle.semanticKey}`,
        ttl: `${ttlSec}s`,
      },
    });

    if (!response.name) return null;

    contextCacheByKey.set(bundle.semanticKey, {
      name: response.name,
      expiresAt: Date.now() + (ttlSec - 3600) * 1000,
    });

    console.log(
      "[HandyLaw query preprocess gemini]",
      JSON.stringify({
        contextCacheCreated: true,
        scope: bundle.scopeLabel,
        model: geminiModel,
        key: bundle.semanticKey,
        promptVersion: NORMALIZE_PROMPT_VERSION,
        promptChars: bundle.systemPrompt.length,
      })
    );

    return response.name;
  } catch (error) {
    markGeminiDepleted(error);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[HandyLaw query preprocess gemini] ${bundle.scopeLabel} context cache unavailable, using dynamic prompt:`,
      message
    );
    return null;
  }
}

export function noteGeminiGenerateFailure(error: unknown) {
  markGeminiDepleted(error);
}
