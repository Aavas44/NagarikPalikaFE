import OpenAI from "openai";
import { openAiChatCacheParams } from "./advocate-chat-cache";
import {
  fromOpenAiUsage,
  recordTokenUsage,
  type UsageOperation,
} from "./token-usage";

export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";

export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-nano";

export const OCR_MODEL = process.env.OPENAI_OCR_MODEL ?? CHAT_MODEL;

export const EMBEDDING_DIMENSION = Number(
  process.env.OPENAI_EMBEDDING_DIMENSION ?? 768
);

let client: OpenAI | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return error.status === 429;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("rate limit");
}

function isRetryableError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timed out|timeout|ETIMEDOUT|ECONNRESET/i.test(message);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = Math.min(2000 * 2 ** (attempt - 1), 60000);
      console.warn(
        `  Retry ${label} in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`Failed ${label} after retries`);
}

/** GPT-5 models only support the default temperature — omit the param. */
export function resolveOpenAiTemperature(model: string): number | undefined {
  if (/^gpt-5/i.test(model)) return undefined;
  return 0;
}

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 120_000);
    client = new OpenAI({ apiKey, timeout: timeoutMs });
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  return withRetry(async () => {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSION,
    });
    fromOpenAiUsage(response.usage, {
      operation: "embedding",
      provider: "openai",
      model: EMBEDDING_MODEL,
    });
    return response.data[0].embedding;
  }, "embedText");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return withRetry(async () => {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSION,
    });
    fromOpenAiUsage(response.usage, {
      operation: "embedding",
      provider: "openai",
      model: EMBEDDING_MODEL,
    });
    return response.data.map((item) => item.embedding);
  }, `embedTexts(${texts.length})`);
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedText(text);
}

export type OpenAiChatCacheOptions = {
  promptCacheKey?: string;
};

export async function streamChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  cacheOptions?: OpenAiChatCacheOptions
) {
  const cacheParams = cacheOptions?.promptCacheKey
    ? openAiChatCacheParams(cacheOptions.promptCacheKey, CHAT_MODEL)
    : {};

  return getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    stream: true,
    stream_options: { include_usage: true },
    ...cacheParams,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  model = process.env.ADVOCATE_ANALYSIS_MODEL ?? CHAT_MODEL,
  operation: UsageOperation = "chat",
  cacheOptions?: OpenAiChatCacheOptions
): Promise<string> {
  return withRetry(async () => {
    const temperature = resolveOpenAiTemperature(model);
    const cacheParams = cacheOptions?.promptCacheKey
      ? openAiChatCacheParams(cacheOptions.promptCacheKey, model)
      : {};

    const response = await getOpenAI().chat.completions.create({
      model,
      ...(temperature !== undefined ? { temperature } : {}),
      ...cacheParams,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    fromOpenAiUsage(response.usage, {
      operation,
      provider: "openai",
      model,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Empty completion from OpenAI");
    }
    return text;
  }, "completeChat");
}

export function isQuotaError(error: unknown): boolean {
  return isRateLimitError(error);
}

export async function transcribeImage(
  imageBuffer: Buffer,
  prompt: string,
  label: string
): Promise<string> {
  const detail =
    process.env.OPENAI_OCR_DETAIL === "low" ? "low" : ("high" as const);
  const base64 = imageBuffer.toString("base64");
  const temperature = resolveOpenAiTemperature(OCR_MODEL);

  return withRetry(async () => {
    const response = await getOpenAI().chat.completions.create({
      model: OCR_MODEL,
      ...(temperature !== undefined ? { temperature } : {}),
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64}`,
                detail,
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error(`Empty OCR result for ${label}`);
    }
    return text;
  }, label);
}
