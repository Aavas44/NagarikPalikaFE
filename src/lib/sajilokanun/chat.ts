import { streamLlmChat, isQuotaError } from "./ai";
import { CHAT_MODEL as OPENAI_CHAT_MODEL } from "./openai";
import { CHAT_MODEL as GEMINI_CHAT_MODEL } from "./gemini";
import { fromGeminiUsage, fromOpenAiUsage, getOpenAiCachedTokens } from "./token-usage";
import {
  citationFromChunk,
  formatCitationBlock,
} from "./chunk-metadata";
import { excerptAroundQuery } from "./text-clean";
import { getProvisionBody } from "./provision-body";
import { type MatchedChunk } from "./supabase";

function provisionText(content: string): string {
  return getProvisionBody(content);
}

export type ChatProvider = "openai" | "gemini" | "ollama" | "extractive" | "auto";

export type TextStream = AsyncIterable<{ text?: string }>;

export function getChatProvider(): ChatProvider {
  const provider = process.env.CHAT_PROVIDER ?? "auto";
  if (
    provider === "openai" ||
    provider === "gemini" ||
    provider === "ollama" ||
    provider === "extractive" ||
    provider === "auto"
  ) {
    return provider;
  }
  return "auto";
}

function buildExtractiveAnswer(
  question: string,
  chunks: MatchedChunk[]
): string {
  const intro =
    chunks.length === 1
      ? "मिलेको कानूनी प्रावधान:"
      : `तपाईंको प्रश्न "${question}" का लागि ${chunks.length} सम्बन्धित प्रावधानहरू फेला परे:"`;

  const sections = chunks.map((chunk, index) => {
    const citation = citationFromChunk(chunk.content, chunk.filename);
    const meta = formatCitationBlock(citation);
    const excerpt = excerptAroundQuery(provisionText(chunk.content), question, 550);
    return `[${index + 1}]\n${meta}\n\n${excerpt}`;
  });

  return `${intro}\n\n${sections.join("\n\n---\n\n")}`;
}

async function* streamText(text: string): TextStream {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    yield { text: word };
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

export function streamVerbatim(text: string): TextStream {
  return streamText(text);
}

export async function streamExtractive(
  question: string,
  chunks: MatchedChunk[]
): Promise<TextStream> {
  return streamText(buildExtractiveAnswer(question, chunks));
}

async function* streamOllamaResponse(
  systemPrompt: string,
  userPrompt: string
): TextStream {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.2";

  const response = await fetch(`${baseUrl}/api/sajilokanun/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No Ollama response stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const payload = JSON.parse(line) as {
        message?: { content?: string };
      };
      const token = payload.message?.content ?? "";
      if (token) yield { text: token };
    }
  }
}

async function streamLlm(
  systemPrompt: string,
  userPrompt: string,
  promptCacheKey?: string
): Promise<TextStream> {
  const stream = await streamLlmChat(
    systemPrompt,
    userPrompt,
    promptCacheKey ? { promptCacheKey } : undefined
  );
  return normalizeLlmStream(stream, promptCacheKey);
}

async function* normalizeLlmStream(
  stream: AsyncIterable<unknown>,
  promptCacheKey?: string
): TextStream {
  for await (const chunk of stream) {
    if (
      chunk &&
      typeof chunk === "object" &&
      "usage" in chunk &&
      (chunk as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } }).usage
    ) {
      const usage = (chunk as {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      }).usage;
      fromOpenAiUsage(usage, {
        operation: "chat",
        provider: "openai",
        model: OPENAI_CHAT_MODEL,
      });
      if (promptCacheKey) {
        const { cachedTokens } = getOpenAiCachedTokens(usage);
        console.log(
          "[HandyLaw chat openai]",
          JSON.stringify({
            operation: "chat",
            promptCacheKey,
            openAiCachedTokens: cachedTokens,
          })
        );
      }
    } else if (
      chunk &&
      typeof chunk === "object" &&
      "usageMetadata" in chunk &&
      (chunk as { usageMetadata?: Record<string, number> }).usageMetadata
    ) {
      fromGeminiUsage(
        (chunk as { usageMetadata?: Record<string, number> }).usageMetadata,
        {
          operation: "chat",
          provider: "gemini",
          model: GEMINI_CHAT_MODEL,
        }
      );
    }

    if (
      chunk &&
      typeof chunk === "object" &&
      "choices" in chunk &&
      Array.isArray((chunk as { choices?: unknown[] }).choices)
    ) {
      const choices = (chunk as { choices: { delta?: { content?: string | null } }[] }).choices;
      const token = choices[0]?.delta?.content ?? "";
      if (token) yield { text: token };
    } else if (
      chunk &&
      typeof chunk === "object" &&
      "text" in chunk &&
      typeof (chunk as { text?: string }).text === "string"
    ) {
      yield { text: (chunk as { text: string }).text };
    }
  }
}

export async function streamChat(options: {
  question: string;
  systemPrompt: string;
  userPrompt: string;
  chunks: MatchedChunk[];
  promptCacheKey?: string;
}): Promise<{ stream: TextStream; chatMode: string }> {
  const provider = getChatProvider();
  const llmMode =
    process.env.LLM_PROVIDER ??
    (process.env.OPENAI_API_KEY ? "openai" : "gemini");

  if (provider === "extractive") {
    return {
      stream: await streamExtractive(options.question, options.chunks),
      chatMode: "extractive",
    };
  }

  if (provider === "ollama") {
    return {
      stream: streamOllamaResponse(options.systemPrompt, options.userPrompt),
      chatMode: "ollama",
    };
  }

  if (provider === "openai" || provider === "gemini") {
    return {
      stream: await streamLlm(
        options.systemPrompt,
        options.userPrompt,
        options.promptCacheKey
      ),
      chatMode: provider,
    };
  }

  // auto: try LLM, fall back to extractive on quota errors
  try {
    return {
      stream: await streamLlm(
        options.systemPrompt,
        options.userPrompt,
        options.promptCacheKey
      ),
      chatMode: llmMode,
    };
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("LLM quota exceeded, using extractive mode");
      return {
        stream: await streamExtractive(options.question, options.chunks),
        chatMode: "extractive",
      };
    }
    throw error;
  }
}
