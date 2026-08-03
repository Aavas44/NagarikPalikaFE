import * as gemini from "./gemini";
import * as openai from "./openai";
import type { OpenAiChatCacheOptions } from "./openai";
import {
  embeddingTextChanged,
  normalizeForEmbedding,
} from "./embedding-text";
import type { UsageOperation } from "./token-usage";

export type { OpenAiChatCacheOptions } from "./openai";

export type LlmProvider = "openai" | "gemini";

const GEMINI_MODEL_RE = /^(gemini-|models\/gemini-)/i;

export function getLlmProvider(): LlmProvider {
  const configured = process.env.LLM_PROVIDER;
  if (configured === "openai" || configured === "gemini") {
    return configured;
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "...") {
    return "openai";
  }
  return "gemini";
}

export function isGeminiModel(model: string): boolean {
  return GEMINI_MODEL_RE.test(model.trim());
}

/** Model for advocate **सारांश** narrative (Gemini by default). */
export function resolveAdvocateAnalysisModel(): string {
  const configured = process.env.ADVOCATE_ANALYSIS_MODEL?.trim();
  if (configured) return configured;
  return "gemini-2.5-pro";
}

function resolveCompleteChatModel(
  model: string | undefined,
  operation: UsageOperation
): string {
  if (model?.trim()) return model.trim();
  if (operation === "narrative") {
    return resolveAdvocateAnalysisModel();
  }
  return getLlmProvider() === "openai"
    ? openai.CHAT_MODEL
    : process.env.GEMINI_CHAT_MODEL?.trim() || gemini.CHAT_MODEL;
}

export async function embedQuery(text: string): Promise<number[]> {
  const normalized = normalizeForEmbedding(text);
  if (embeddingTextChanged(text, normalized)) {
    console.log(
      "[HandyLaw embed normalize]",
      JSON.stringify({ before: text.slice(0, 120), after: normalized.slice(0, 120) })
    );
  }
  return getLlmProvider() === "openai"
    ? openai.embedQuery(normalized)
    : gemini.embedQuery(normalized);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const normalized = texts.map(normalizeForEmbedding);
  return getLlmProvider() === "openai"
    ? openai.embedTexts(normalized)
    : gemini.embedTexts(normalized);
}

export function isQuotaError(error: unknown): boolean {
  return getLlmProvider() === "openai"
    ? openai.isQuotaError(error)
    : gemini.isQuotaError(error);
}

export async function streamLlmChat(
  systemPrompt: string,
  userPrompt: string,
  cacheOptions?: OpenAiChatCacheOptions
) {
  if (getLlmProvider() === "openai") {
    return openai.streamChatCompletion(systemPrompt, userPrompt, cacheOptions);
  }
  return gemini.getGemini().models.generateContentStream({
    model: gemini.CHAT_MODEL,
    contents: userPrompt,
    config: { systemInstruction: systemPrompt },
  });
}

/**
 * Complete a chat turn. Gemini model names always go to Gemini
 * (GEMINI_API_KEY → GEMINI_API_KEY_FALLBACK), even when LLM_PROVIDER=openai.
 * Advocate narrative defaults to ADVOCATE_ANALYSIS_MODEL (gemini-3.5-flash-lite).
 */
export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  operation: UsageOperation = "chat",
  cacheOptions?: OpenAiChatCacheOptions
): Promise<string> {
  const resolved = resolveCompleteChatModel(model, operation);
  if (isGeminiModel(resolved)) {
    return gemini.completeChat(systemPrompt, userPrompt, resolved, operation);
  }
  return openai.completeChat(
    systemPrompt,
    userPrompt,
    resolved,
    operation,
    cacheOptions
  );
}
