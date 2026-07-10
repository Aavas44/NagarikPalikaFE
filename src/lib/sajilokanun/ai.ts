import * as gemini from "./gemini";
import * as openai from "./openai";
import {
  embeddingTextChanged,
  normalizeForEmbedding,
} from "./embedding-text";

export type LlmProvider = "openai" | "gemini";

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

export async function streamLlmChat(systemPrompt: string, userPrompt: string) {
  if (getLlmProvider() === "openai") {
    return openai.streamChatCompletion(systemPrompt, userPrompt);
  }
  return gemini.getGemini().models.generateContentStream({
    model: gemini.CHAT_MODEL,
    contents: userPrompt,
    config: { systemInstruction: systemPrompt },
  });
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  return getLlmProvider() === "openai"
    ? openai.completeChat(systemPrompt, userPrompt, model)
    : gemini.completeChat(systemPrompt, userPrompt, model);
}
