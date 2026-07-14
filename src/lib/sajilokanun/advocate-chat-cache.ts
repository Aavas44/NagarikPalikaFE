import { createHash } from "crypto";
import type { ParsedBookScope } from "./book-scope";
import { openAiPromptCacheParams } from "./normalize-prompt-cache";
import type { MatchedChunk } from "./supabase";

export type AdvocateChatCacheMode = "advocate" | "quote";

export function bookScopeCacheLabel(scope: ParsedBookScope): string {
  if (Array.isArray(scope)) return [...scope].sort().join("+");
  return scope;
}

/** Stable cache key from retrieved chunks + book scope (shared across similar questions). */
export function buildAdvocatePromptCacheKey(
  chunks: Pick<MatchedChunk, "id" | "filename" | "section_label">[],
  bookScope: ParsedBookScope,
  mode: AdvocateChatCacheMode = "advocate"
): string {
  const fingerprint = [...chunks]
    .map(
      (chunk) =>
        `${chunk.id}|${chunk.filename}|${chunk.section_label?.split(".")[0] ?? ""}`
    )
    .sort()
    .join(";");

  const hash = createHash("sha256")
    .update(`${mode}:${bookScopeCacheLabel(bookScope)}:${fingerprint}`)
    .digest("hex")
    .slice(0, 12);

  return `handyLaw-chat-${mode}-${hash}`;
}

export function openAiChatCacheParams(
  promptCacheKey: string,
  model: string
): { prompt_cache_key: string; prompt_cache_retention?: "24h" } {
  return openAiPromptCacheParams(promptCacheKey, model);
}
