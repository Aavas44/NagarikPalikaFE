import dns from "dns";
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { MinIntervalQueue, rpmToIntervalMs } from "./rate-limit";

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

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error;
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

export async function embedText(text: string): Promise<number[]> {
  return withRetry(async () => {
    const result = await getGemini().models.embedContent({
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

    return values;
  }, "embedText");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return withRetry(async () => {
    const result = await getGemini().models.embedContent({
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

    return embeddings.map((item) => {
      if (!item.values) {
        throw new Error("Missing embedding values");
      }
      return item.values;
    });
  }, `embedTexts(${texts.length})`);
}

export async function embedQuery(text: string): Promise<number[]> {
  return withRetry(async () => {
    const result = await getGemini().models.embedContent({
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

    return values;
  }, "embedQuery");
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  model = process.env.ADVOCATE_ANALYSIS_MODEL ?? CHAT_MODEL
): Promise<string> {
  return withRetry(async () => {
    const response = await getGemini().models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0,
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new Error("Empty completion from Gemini");
    }
    return text;
  }, "completeChat");
}
