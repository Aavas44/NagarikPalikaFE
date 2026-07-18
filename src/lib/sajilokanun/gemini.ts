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
  process.env.GEMINI_OCR_MODEL ?? CHAT_MODEL;

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

let client: GoogleGenAI | null = null;
let fallbackClient: GoogleGenAI | null = null;

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

async function withRetry<T>(fn: (activeClient: GoogleGenAI) => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 6;
  let useFallback = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const activeClient = useFallback ? (getGeminiFallback() ?? getGemini()) : getGemini();
      return await fn(activeClient);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error;
      }

      if (!useFallback && getGeminiFallback()) {
        console.warn(`  Rate limited on ${label}, switching to fallback key (attempt ${attempt}/${maxAttempts})`);
        useFallback = true;
        continue;
      }

      const waitMs = Math.min(2000 * 2 ** (attempt - 1), 60000);
      console.warn(
        `  Rate limited on ${label}, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`Failed ${label} after retries`);
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

export function getGemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function getGeminiFallback(): GoogleGenAI | null {
  if (!fallbackClient) {
    const apiKey = process.env.GEMINI_API_KEY_FALLBACK;
    if (!apiKey) return null;
    fallbackClient = new GoogleGenAI({ apiKey });
  }
  return fallbackClient;
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
      promptTokens: texts.reduce((sum, text) => sum + estimateTokensFromText(text), 0),
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
  return withRetry(async (activeClient) => {
    const response = await activeClient.models.generateContent({
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
    const text = response.text?.trim();
    if (!text) {
      throw new Error("Empty completion from Gemini");
    }
    return text;
  }, "completeChat");
}
