import fs from "fs/promises";
import type { GlossaryEntry, GlossaryFile, GlossarySearchResult } from "@/types/glossary";
import { dataFilePath } from "@/lib/dataPath";

const GLOSSARY_PATH = dataFilePath("kanuni-shabdakosh-glossary-roman-fixed.json");

let cachedEntries: GlossaryEntry[] | null = null;

async function loadEntries(): Promise<GlossaryEntry[]> {
  if (cachedEntries) return cachedEntries;
  const raw = await fs.readFile(GLOSSARY_PATH, "utf-8");
  const data = JSON.parse(raw) as GlossaryFile;
  cachedEntries = data.entries;
  return cachedEntries;
}

function normalizeAscii(value: string): string {
  return value.trim().toLowerCase();
}

/** Subsequence match — letters of query appear in order in target. */
function subsequenceMatch(target: string, query: string): boolean {
  let i = 0;
  for (const ch of target) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return false;
}

function scoreField(field: string, query: string, caseSensitive: boolean): number {
  if (!field || !query) return 0;

  const hay = caseSensitive ? field.trim() : normalizeAscii(field);
  const needle = caseSensitive ? query.trim() : normalizeAscii(query);
  if (!needle) return 0;

  if (hay === needle) return 100;
  if (hay.startsWith(needle)) return 90;

  const parts = hay.split(/[/\s,]+/);
  for (const part of parts) {
    if (part === needle) return 95;
    if (part.startsWith(needle)) return 85;
  }

  if (hay.includes(needle)) return 70;

  if (!caseSensitive && needle.length >= 3 && subsequenceMatch(hay, needle)) {
    return 45;
  }

  return 0;
}

function scoreEntry(entry: GlossaryEntry, query: string): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const roman = entry["Roman Transliteration"] ?? "";
  const english = entry.english ?? "";

  return Math.max(
    scoreField(entry.term, trimmed, true),
    scoreField(roman, trimmed, false),
    scoreField(english, trimmed, false)
  );
}

export async function searchGlossary(
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
      score: scoreEntry(entry, trimmed),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term));

  const results: GlossarySearchResult[] = scored.slice(0, limit).map(({ entry, score }) => ({
    term: entry.term,
    romanTransliteration: entry["Roman Transliteration"],
    english: entry.english,
    meaning: entry.meaning,
    score,
  }));

  return { total: scored.length, results };
}

export async function getGlossaryCount(): Promise<number> {
  const entries = await loadEntries();
  return entries.length;
}
