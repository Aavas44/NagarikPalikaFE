import { getSupabaseAdmin } from "./supabase";
import { extractChapterDisplayName } from "./provision-title-search";
import { ROMAN_WORDS } from "./roman-nepali-transliterate";
import type { BookScope } from "./lawbooks";

export type VocabEntry = {
  term: string;
  kind: "section_title" | "chapter" | "core";
};

const CORE_TERMS: VocabEntry[] = [
  { term: "अदालती शुल्क", kind: "core" },
  { term: "मिलापत्र", kind: "core" },
  { term: "खारेज", kind: "core" },
  { term: "डिसमिस", kind: "core" },
  { term: "प्रतिउत्तरपत्र", kind: "core" },
  { term: "लिखित प्रतिउत्तर", kind: "core" },
  { term: "फिरादपत्र", kind: "core" },
  { term: "देवानी मुद्दा", kind: "core" },
  { term: "फौजदारी मुद्दा", kind: "core" },
  { term: "झुठ्ठा उजुरी", kind: "core" },
  { term: "हिरासत", kind: "core" },
  { term: "अनुसन्धान", kind: "core" },
  { term: "धरौटी", kind: "core" },
  { term: "थमाउ", kind: "core" },
  { term: "म्याद", kind: "core" },
  { term: "बाल विवाह", kind: "core" },
  { term: "हत्या", kind: "core" },
  { term: "चोरी", kind: "core" },
];

const CACHE_TTL_MS = 60 * 60 * 1000;
const cachedIndexedByBook = new Map<string, VocabEntry[]>();
const cacheLoadedAtByBook = new Map<string, number>();

function vocabularyCacheKey(bookScope?: BookScope): string {
  return bookScope && bookScope !== "auto" ? bookScope : "all";
}

function normalizeTerm(term: string): string {
  return term.replace(/[ः:]+$/u, "").replace(/\s+/g, " ").trim();
}

function queryTokens(query: string): string[] {
  const lower = query.toLowerCase();
  const roman = lower.match(/[a-z]{2,}/g) ?? [];
  const deva = query.match(/[\u0900-\u097F]+/gu) ?? [];
  const expanded: string[] = [...roman, ...deva.map((w) => w.trim())];

  for (const word of roman) {
    const nepali = ROMAN_WORDS[word];
    if (nepali) expanded.push(nepali);
  }

  return [...new Set(expanded.filter((t) => t.length >= 2))];
}

function entryMatchesQuery(entry: VocabEntry, tokens: string[]): number {
  const term = entry.term;
  const termLower = term.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (term.includes(token) || token.includes(term)) score += 3;
    if (termLower.includes(token.toLowerCase())) score += 2;
  }

  return score;
}

async function fetchIndexedVocabulary(bookScope?: BookScope): Promise<VocabEntry[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("chunks")
    .select("section_title, chapter, documents!inner(indexing_rule_id)")
    .limit(4000);

  if (bookScope && bookScope !== "auto") {
    query = query.eq("documents.indexing_rule_id", bookScope);
  }

  const { data, error } = await query;

  if (error || !data?.length) return [];

  const seen = new Set<string>();
  const out: VocabEntry[] = [];

  for (const row of data) {
    const title =
      typeof row.section_title === "string"
        ? normalizeTerm(row.section_title)
        : "";
    if (title.length >= 4 && title.length <= 120 && !seen.has(title)) {
      seen.add(title);
      out.push({ term: title, kind: "section_title" });
    }

    const chapter =
      typeof row.chapter === "string" ? extractChapterDisplayName(row.chapter) : "";
    if (chapter.length >= 4 && chapter.length <= 80 && !seen.has(chapter)) {
      seen.add(chapter);
      out.push({ term: chapter, kind: "chapter" });
    }
  }

  return out;
}

/** Load दफा titles + परिच्छेद names from indexed chunks (in-memory cache). */
export async function loadIndexedVocabulary(
  bookScope?: BookScope
): Promise<VocabEntry[]> {
  const cacheKey = vocabularyCacheKey(bookScope);
  const cached = cachedIndexedByBook.get(cacheKey);
  const loadedAt = cacheLoadedAtByBook.get(cacheKey) ?? 0;

  if (cached && Date.now() - loadedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const indexed = await fetchIndexedVocabulary(bookScope);
    const merged = [...CORE_TERMS, ...indexed];
    cachedIndexedByBook.set(cacheKey, merged);
    cacheLoadedAtByBook.set(cacheKey, Date.now());
    console.log(
      "[HandyLaw vocabulary]",
      JSON.stringify({
        bookScope: bookScope ?? "all",
        indexed: indexed.length,
        total: merged.length,
      })
    );
    return merged;
  } catch (error) {
    console.warn("[HandyLaw vocabulary] DB load failed, using core terms only", error);
    const fallback = [...CORE_TERMS];
    cachedIndexedByBook.set(cacheKey, fallback);
    cacheLoadedAtByBook.set(cacheKey, Date.now());
    return fallback;
  }
}

/** Terms from the index most relevant to this query (for LLM normalize prompt). */
export async function vocabularyHintsForQuery(
  query: string,
  options: { maxTerms?: number; bookScope?: BookScope } = {}
): Promise<string[]> {
  const { maxTerms = 10, bookScope } = options;
  const vocab = await loadIndexedVocabulary(bookScope);
  const tokens = queryTokens(query);

  const scored = vocab
    .map((entry) => ({ entry, score: entryMatchesQuery(entry, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.term.length - b.entry.term.length);

  const picked = scored.slice(0, maxTerms).map((item) => item.entry.term);

  if (picked.length < 12) {
    for (const core of CORE_TERMS) {
      if (picked.length >= maxTerms) break;
      if (!picked.includes(core.term)) picked.push(core.term);
    }
  }

  return picked;
}
