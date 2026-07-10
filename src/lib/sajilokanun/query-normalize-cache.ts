import type { BookScope } from "./lawbooks";
import type { NormalizedQuery } from "./query-translate";
import { NORMALIZE_PROMPT_VERSION } from "./query-normalize-prompt";

const TTL_MS = Number(process.env.QUERY_NORMALIZE_CACHE_TTL_MS ?? 24 * 60 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.QUERY_NORMALIZE_CACHE_MAX ?? 500);

type CacheEntry = {
  expiresAt: number;
  value: NormalizedQuery;
};

const cache = new Map<string, CacheEntry>();

function normalizeCacheKey(query: string, book?: BookScope): string {
  const bookPart = book && book !== "auto" ? `|${book}` : "";
  return `${NORMALIZE_PROMPT_VERSION}|${query.trim().toLowerCase()}${bookPart}`;
}

export function getCachedNormalize(
  query: string,
  book?: BookScope
): NormalizedQuery | null {
  const key = normalizeCacheKey(query, book);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedNormalize(
  query: string,
  value: NormalizedQuery,
  book?: BookScope
): void {
  const key = normalizeCacheKey(query, book);
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { expiresAt: Date.now() + TTL_MS, value });
}
