import dns from "dns";
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { MinIntervalQueue, rpmToIntervalMs } from "./rate-limit";
import {
  estimateTokensFromText,
  fromGeminiUsage,
  recordTokenUsage,
  type UsageOperation,
} from "./token-usage";

dns.setDefaultResultOrder("ipv4first");

export const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";

export const GEMINI_OCR_MODEL =
  process.env.DOCUMENT_EXTRACTION_MODEL?.trim() ||
  process.env.GEMINI_OCR_MODEL?.trim() ||
  "gemini-3.5-flash";

/** Free tier is ~15 RPM for Flash — stay under with a serial queue. */
const geminiOcrQueue = new MinIntervalQueue(
  Number(process.env.GEMINI_MIN_INTERVAL_MS) ||
    rpmToIntervalMs(Number(process.env.GEMINI_OCR_RPM ?? 15))
);

export function geminiOcrIntervalMs(): number {
  return (
    Number(process.env.GEMINI_MIN_INTERVAL_MS) ||
    rpmToIntervalMs(Number(process.env.GEMINI_OCR_RPM ?? 15))
  );
}

export async function waitForGeminiOcrSlot(): Promise<void> {
  await geminiOcrQueue.wait();
}

export const EMBEDDING_DIMENSION = Number(
  process.env.GEMINI_EMBEDDING_DIMENSION ?? 768
);

export type GeminiPoolEntry = {
  id: string | null;
  label: string;
  role: "default" | "fallback" | "pool" | "env";
  apiKey: string;
  client: GoogleGenAI;
};

const POOL_TTL_MS = Number(process.env.GEMINI_KEY_POOL_TTL_MS ?? 45_000);
let poolCache: GeminiPoolEntry[] | null = null;
let poolCacheExpiresAt = 0;
let poolCacheInflight: Promise<GeminiPoolEntry[]> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return error.status === 429;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
}

export function isQuotaError(error: unknown): boolean {
  return isRateLimitError(error);
}

export function shouldUseGeminiKeyFallback(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (
      typeof status === "number" &&
      [400, 401, 403, 429, 500, 502, 503, 504].includes(status)
    ) {
      return true;
    }
    if (
      status === "UNAVAILABLE" ||
      status === "RESOURCE_EXHAUSTED" ||
      status === "INVALID_ARGUMENT" ||
      status === "PERMISSION_DENIED"
    ) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /"code"\s*:\s*(400|401|403|429|500|502|503|504)/.test(message) ||
    /"status"\s*:\s*"(UNAVAILABLE|RESOURCE_EXHAUSTED|INVALID_ARGUMENT|PERMISSION_DENIED)"/i.test(
      message
    ) ||
    /API_KEY_INVALID|API key not valid|CachedContent not found/i.test(message) ||
    /high demand|prepayment credits|depleted|billing/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|fetch failed/i.test(message) ||
    /\b503\b/.test(message) ||
    /\b429\b/.test(message) ||
    /Empty completion from Gemini/.test(message)
  );
}

function apiBaseUrl(): string {
  return (process.env.API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

function internalSecret(): string {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-cron-secret"
  );
}

function envFallbackPool(): GeminiPoolEntry[] {
  const entries: GeminiPoolEntry[] = [];
  const primary = process.env.GEMINI_API_KEY?.trim();
  const fallback = process.env.GEMINI_API_KEY_FALLBACK?.trim();
  if (primary) {
    entries.push({
      id: null,
      label: "GEMINI_API_KEY",
      role: "env",
      apiKey: primary,
      client: new GoogleGenAI({ apiKey: primary }),
    });
  }
  if (fallback && fallback !== primary) {
    entries.push({
      id: null,
      label: "GEMINI_API_KEY_FALLBACK",
      role: "env",
      apiKey: fallback,
      client: new GoogleGenAI({ apiKey: fallback }),
    });
  }
  return entries;
}

async function fetchRuntimePoolFromApi(): Promise<GeminiPoolEntry[]> {
  const res = await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/runtime`, {
    headers: {
      "x-internal-secret": internalSecret(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`runtime pool HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    keys?: Array<{
      id: string;
      label: string;
      role: "default" | "fallback" | "pool";
      apiKey: string;
    }>;
  };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  return keys
    .filter((k) => k.apiKey?.trim())
    .map((k) => ({
      id: k.id,
      label: k.label || k.role,
      role: k.role,
      apiKey: k.apiKey.trim(),
      client: new GoogleGenAI({ apiKey: k.apiKey.trim() }),
    }));
}

async function bootstrapPoolFromEnvIfEmpty(): Promise<void> {
  const keys: Array<{
    label: string;
    apiKey: string;
    role: "default" | "fallback" | "pool";
  }> = [];
  const primary = process.env.GEMINI_API_KEY?.trim();
  const fallback = process.env.GEMINI_API_KEY_FALLBACK?.trim();
  if (primary) {
    keys.push({
      label: "GEMINI_API_KEY",
      apiKey: primary,
      role: "default",
    });
  }
  if (fallback) {
    keys.push({
      label: "GEMINI_API_KEY_FALLBACK",
      apiKey: fallback,
      role: primary ? "fallback" : "default",
    });
  }
  if (!keys.length) return;

  await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/import-env`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret(),
    },
    body: JSON.stringify({ keys }),
    cache: "no-store",
  }).catch(() => {
    /* ignore — env fallback still works */
  });
}

async function reportKeyError(entry: GeminiPoolEntry, error: unknown): Promise<void> {
  if (!entry.id) return;
  const message = error instanceof Error ? error.message : String(error);
  await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/${entry.id}/report-error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret(),
    },
    body: JSON.stringify({ error: message.slice(0, 500) }),
    cache: "no-store",
  }).catch(() => {
    /* non-fatal */
  });
}

async function markKeyUsed(entry: GeminiPoolEntry): Promise<void> {
  if (!entry.id) return;
  await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/${entry.id}/mark-used`, {
    method: "POST",
    headers: {
      "x-internal-secret": internalSecret(),
    },
    cache: "no-store",
  }).catch(() => {
    /* non-fatal */
  });
}

/** Record successful use for admin UI (normalize and other custom loops). */
export async function markGeminiKeyUsed(keyId: string | null | undefined): Promise<void> {
  if (!keyId) return;
  await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/${keyId}/mark-used`, {
    method: "POST",
    headers: {
      "x-internal-secret": internalSecret(),
    },
    cache: "no-store",
  }).catch(() => {
    /* non-fatal */
  });
}

/** Record failure for admin UI (normalize and other custom loops). */
export async function reportGeminiKeyError(
  keyId: string | null | undefined,
  error: unknown
): Promise<void> {
  if (!keyId) return;
  const message = error instanceof Error ? error.message : String(error);
  await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/${keyId}/report-error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret(),
    },
    body: JSON.stringify({ error: message.slice(0, 500) }),
    cache: "no-store",
  }).catch(() => {
    /* non-fatal */
  });
}

/** Load ordered Gemini keys: Mongo pool (default → pool → fallback), else env. */
export async function resolveGeminiKeyPool(
  options?: { force?: boolean }
): Promise<GeminiPoolEntry[]> {
  const now = Date.now();
  if (
    !options?.force &&
    poolCache &&
    now < poolCacheExpiresAt &&
    poolCache.length > 0
  ) {
    return poolCache;
  }
  if (!options?.force && poolCacheInflight) {
    return poolCacheInflight;
  }

  poolCacheInflight = (async () => {
    try {
      let entries = await fetchRuntimePoolFromApi();
      if (!entries.length) {
        await bootstrapPoolFromEnvIfEmpty();
        entries = await fetchRuntimePoolFromApi().catch(() => []);
      }
      if (!entries.length) {
        entries = envFallbackPool();
      }
      if (!entries.length) {
        throw new Error(
          "No Gemini API keys configured (admin pool empty and GEMINI_API_KEY missing)"
        );
      }
      poolCache = entries;
      poolCacheExpiresAt = Date.now() + POOL_TTL_MS;
      return entries;
    } catch (err) {
      const fallback = envFallbackPool();
      if (fallback.length) {
        console.warn(
          "[HandyLaw gemini]",
          "key pool unavailable, using env keys:",
          err instanceof Error ? err.message : String(err)
        );
        poolCache = fallback;
        poolCacheExpiresAt = Date.now() + Math.min(POOL_TTL_MS, 15_000);
        return fallback;
      }
      throw err instanceof Error
        ? err
        : new Error("Failed to resolve Gemini key pool");
    } finally {
      poolCacheInflight = null;
    }
  })();

  return poolCacheInflight;
}

export function invalidateGeminiKeyPoolCache(): void {
  poolCache = null;
  poolCacheExpiresAt = 0;
}

/** Ordered clients for callers that build their own rotation loops. */
export async function listGeminiClientsOrdered(): Promise<
  Array<{ id: string | null; label: string; client: GoogleGenAI }>
> {
  const pool = await resolveGeminiKeyPool();
  return pool.map((e) => ({ id: e.id, label: e.label, client: e.client }));
}

/**
 * Run `fn` against the key pool. On 429 / retryable errors, try the next key.
 * Also applies limited backoff retries on the same key for pure rate limits.
 */
export async function withGeminiClientRotation<T>(
  operationLabel: string,
  fn: (client: GoogleGenAI, entry: GeminiPoolEntry) => Promise<T>
): Promise<T> {
  const pool = await resolveGeminiKeyPool();
  let lastError: unknown;

  for (let i = 0; i < pool.length; i++) {
    const entry = pool[i]!;
    const maxAttemptsOnKey = 2;
    for (let attempt = 1; attempt <= maxAttemptsOnKey; attempt++) {
      try {
        const result = await fn(entry.client, entry);
        void markKeyUsed(entry);
        if (i > 0) {
          console.warn(
            "[HandyLaw gemini]",
            JSON.stringify({
              operation: operationLabel,
              apiKey: entry.label,
              rotated: true,
            })
          );
        }
        return result;
      } catch (error) {
        lastError = error;
        const retryable = shouldUseGeminiKeyFallback(error);
        void reportKeyError(entry, error);

        if (!retryable) throw error;

        const hasNextKey = i < pool.length - 1;
        const rateLimited = isRateLimitError(error);

        console.warn(
          "[HandyLaw gemini]",
          JSON.stringify({
            operation: operationLabel,
            apiKey: entry.label,
            attempt,
            nextApiKey: hasNextKey ? pool[i + 1]?.label : null,
            reason: error instanceof Error ? error.message : String(error),
          })
        );

        if (rateLimited && attempt < maxAttemptsOnKey && !hasNextKey) {
          const waitMs = Math.min(2000 * 2 ** (attempt - 1), 15000);
          await sleep(waitMs);
          continue;
        }

        // Prefer switching keys on 429 / retryable errors.
        if (hasNextKey) break;
        if (attempt === maxAttemptsOnKey) break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? `Failed ${operationLabel}`));
}

async function withRetry<T>(
  fn: (activeClient: GoogleGenAI) => Promise<T>,
  label: string
): Promise<T> {
  return withGeminiClientRotation(label, (client) => fn(client));
}

/** JSON/text from Gemini — skips thinking parts (2.5 thinking models). */
export function extractGeminiResponseText(
  response: GenerateContentResponse
): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts?.length) {
    const text = parts
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text!)
      .join("")
      .trim();
    if (text) return text;
  }
  return response.text?.trim() ?? "";
}

/** Sync primary client (env or last cached pool default). Prefer async rotation helpers. */
export function getGemini(): GoogleGenAI {
  if (poolCache?.[0]) return poolCache[0].client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }
  return new GoogleGenAI({ apiKey });
}

export function getGeminiFallback(): GoogleGenAI | null {
  if (poolCache && poolCache.length > 1) {
    return poolCache[poolCache.length - 1]!.client;
  }
  const apiKey = process.env.GEMINI_API_KEY_FALLBACK?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export async function embedText(text: string): Promise<number[]> {
  return withRetry(async (activeClient) => {
    const result = await activeClient.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const values = result.embeddings?.[0]?.values;
    if (!values) {
      throw new Error("No embedding returned from Gemini");
    }

    recordTokenUsage({
      operation: "embedding",
      provider: "gemini",
      model: EMBEDDING_MODEL,
      promptTokens: estimateTokensFromText(text),
      completionTokens: 0,
    });

    return values;
  }, "embedText");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return withRetry(async (activeClient) => {
    const result = await activeClient.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const embeddings = result.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Expected ${texts.length} embeddings, got ${embeddings.length}`
      );
    }

    recordTokenUsage({
      operation: "embedding",
      provider: "gemini",
      model: EMBEDDING_MODEL,
      promptTokens: texts.reduce(
        (sum, text) => sum + estimateTokensFromText(text),
        0
      ),
      completionTokens: 0,
    });

    return embeddings.map((item) => {
      if (!item.values) {
        throw new Error("Missing embedding values");
      }
      return item.values;
    });
  }, `embedTexts(${texts.length})`);
}

export async function embedQuery(text: string): Promise<number[]> {
  return withRetry(async (activeClient) => {
    const result = await activeClient.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const values = result.embeddings?.[0]?.values;
    if (!values) {
      throw new Error("No embedding returned from Gemini");
    }

    recordTokenUsage({
      operation: "embedding",
      provider: "gemini",
      model: EMBEDDING_MODEL,
      promptTokens: estimateTokensFromText(text),
      completionTokens: 0,
    });

    return values;
  }, "embedQuery");
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  model = process.env.ADVOCATE_ANALYSIS_MODEL ?? CHAT_MODEL,
  operation: UsageOperation = "chat"
): Promise<string> {
  return withGeminiClientRotation(`completeChat:${operation}`, async (client) => {
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0,
      },
    });
    fromGeminiUsage(response.usageMetadata, {
      operation,
      provider: "gemini",
      model,
    });
    const text = extractGeminiResponseText(response);
    if (!text) {
      throw new Error("Empty completion from Gemini");
    }
    return text;
  });
}

export type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Multimodal generateContent (images / PDF + text). Uses superadmin Gemini key pool. */
export async function completeMultimodal(
  systemPrompt: string,
  parts: GeminiContentPart[],
  model = GEMINI_OCR_MODEL,
  operation: UsageOperation = "analysis",
  options?: { maxOutputTokens?: number }
): Promise<string> {
  if (!parts.length) {
    throw new Error("At least one content part is required");
  }
  const maxOutputTokens = options?.maxOutputTokens ?? 8192;
  return withGeminiClientRotation(`completeMultimodal:${operation}`, async (client) => {
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens,
      },
    });
    fromGeminiUsage(response.usageMetadata, {
      operation,
      provider: "gemini",
      model,
    });
    const text = extractGeminiResponseText(response);
    if (!text) {
      throw new Error("Empty completion from Gemini");
    }
    return text;
  });
}
