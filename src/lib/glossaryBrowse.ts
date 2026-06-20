import type { GlossaryEntry, GlossarySearchResult } from "@/types/glossary";
import { dataFilePath } from "@/lib/dataPath";
import { getIndexLetter, isNepaliIndexLetter } from "@/lib/glossaryIndex";
import fs from "fs/promises";

const GLOSSARY_PATH = dataFilePath("kanuni-shabdakosh-glossary-roman-fixed.json");

let cachedSortedEntries: GlossaryEntry[] | null = null;
let cachedIndexCounts: Record<string, number> | null = null;

async function loadSortedEntries(): Promise<GlossaryEntry[]> {
  if (cachedSortedEntries) return cachedSortedEntries;
  const raw = await fs.readFile(GLOSSARY_PATH, "utf-8");
  const data = JSON.parse(raw) as { entries: GlossaryEntry[] };
  cachedSortedEntries = [...data.entries]
    .filter((entry) => entry.meaning?.trim())
    .sort((a, b) => a.term.localeCompare(b.term, "ne"));
  return cachedSortedEntries;
}

function entryToResult(entry: GlossaryEntry): GlossarySearchResult {
  return {
    term: entry.term,
    romanTransliteration: entry["Roman Transliteration"],
    english: entry.english,
    meaning: entry.meaning,
    source: "kanuni",
    score: 0,
  };
}

export async function getKanuniIndexCounts(): Promise<Record<string, number>> {
  if (cachedIndexCounts) return cachedIndexCounts;
  const entries = await loadSortedEntries();
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const letter = getIndexLetter(entry.term);
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  cachedIndexCounts = counts;
  return counts;
}

export async function browseKanuniGlossary(options: {
  letter?: string | null;
  page?: number;
  limit?: number;
}): Promise<{
  letter: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  results: GlossarySearchResult[];
  indexCounts: Record<string, number>;
}> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const letter =
    options.letter && isNepaliIndexLetter(options.letter) ? options.letter : null;

  const [allEntries, indexCounts] = await Promise.all([
    loadSortedEntries(),
    getKanuniIndexCounts(),
  ]);

  const filtered = letter
    ? allEntries.filter((entry) => getIndexLetter(entry.term) === letter)
    : allEntries;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const results = filtered.slice(start, start + limit).map(entryToResult);

  return {
    letter,
    page: safePage,
    limit,
    total,
    totalPages,
    results,
    indexCounts,
  };
}
