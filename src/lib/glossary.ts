import fs from "fs/promises";
import type { GlossaryEntry, GlossaryFile, GlossarySearchResult } from "@/types/glossary";
import { dataFilePath } from "@/lib/dataPath";
import {
  mergeGlossaryResults,
  scoreGlossaryLabels,
} from "@/lib/glossarySearchCore";
import { searchSaralSewaGlossary } from "@/lib/saralsewa-glossary";

const GLOSSARY_PATH = dataFilePath("kanuni-shabdakosh-glossary-roman-fixed.json");

let cachedEntries: GlossaryEntry[] | null = null;

async function loadEntries(): Promise<GlossaryEntry[]> {
  if (cachedEntries) return cachedEntries;
  const raw = await fs.readFile(GLOSSARY_PATH, "utf-8");
  const data = JSON.parse(raw) as GlossaryFile;
  cachedEntries = data.entries;
  return cachedEntries;
}

function scoreKanuniEntry(entry: GlossaryEntry, query: string): number {
  return scoreGlossaryLabels(query, {
    term: entry.term,
    roman: entry["Roman Transliteration"] ?? "",
    english: entry.english,
  });
}

async function searchKanuniGlossary(
  query: string,
  limit = 30
): Promise<{ total: number; results: GlossarySearchResult[] }> {
  const entries = await loadEntries();
  const trimmed = query.trim();

  if (!trimmed) {
    return { total: 0, results: [] };
  }

  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreKanuniEntry(entry, trimmed),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term));

  const results: GlossarySearchResult[] = scored.slice(0, limit).map(({ entry, score }) => ({
    term: entry.term,
    romanTransliteration: entry["Roman Transliteration"],
    english: entry.english,
    meaning: entry.meaning,
    source: "kanuni",
    score,
  }));

  return { total: scored.length, results };
}

export async function searchGlossary(
  query: string,
  limit = 30
): Promise<{ total: number; results: GlossarySearchResult[] }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { total: 0, results: [] };
  }

  const fetchLimit = Math.max(limit * 3, 50);
  const [saral, kanuni] = await Promise.all([
    searchSaralSewaGlossary(trimmed, fetchLimit),
    searchKanuniGlossary(trimmed, fetchLimit),
  ]);

  return mergeGlossaryResults([saral, kanuni], limit);
}

export async function getGlossaryCount(): Promise<number> {
  const entries = await loadEntries();
  return entries.length;
}
