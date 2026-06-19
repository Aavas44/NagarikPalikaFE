import type { GlossarySearchResult } from "@/types/glossary";

export function normalizeAscii(value: string): string {
  return value.trim().toLowerCase();
}

/** Roman fields often use dots (A.Na.Mi.) — strip for matching. */
export function normalizeRoman(value: string): string {
  return normalizeAscii(value.replace(/\./g, ""));
}

/** Subsequence match — letters of query appear in order in target. */
export function subsequenceMatch(target: string, query: string): boolean {
  let i = 0;
  for (const ch of target) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return false;
}

export function scoreField(
  field: string,
  query: string,
  caseSensitive: boolean,
  options?: { allowSubsequence?: boolean; normalizeDots?: boolean }
): number {
  if (!field || !query) return 0;

  const allowSubsequence = options?.allowSubsequence ?? true;
  const hay = caseSensitive
    ? field.trim()
    : options?.normalizeDots
      ? normalizeRoman(field)
      : normalizeAscii(field);
  const needle = caseSensitive
    ? query.trim()
    : options?.normalizeDots
      ? normalizeRoman(query)
      : normalizeAscii(query);
  if (!needle) return 0;

  if (hay === needle) return 100;
  if (hay.startsWith(needle)) return 90;

  const parts = hay.split(/[/\s,]+/);
  for (const part of parts) {
    if (part === needle) return 95;
    if (part.startsWith(needle)) return 85;
  }

  if (hay.includes(needle)) return 70;

  if (allowSubsequence && !caseSensitive && needle.length >= 3 && subsequenceMatch(hay, needle)) {
    return 45;
  }

  return 0;
}

/** Score against Nepali term, Roman transliteration, and English label. */
export function scoreGlossaryLabels(
  query: string,
  fields: { term: string; roman: string; english?: string | null }
): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const roman = fields.roman ?? "";
  const english = fields.english ?? "";

  return Math.max(
    scoreField(fields.term, trimmed, true),
    scoreField(roman, trimmed, false, { normalizeDots: true }),
    scoreField(english, trimmed, false)
  );
}

export function dedupeGlossaryKey(term: string, roman: string): string {
  const normalizedRoman = normalizeRoman(roman);
  if (normalizedRoman) return normalizedRoman;
  return term.trim();
}

export function mergeGlossaryResults(
  groups: { total: number; results: GlossarySearchResult[] }[],
  limit: number
): { total: number; results: GlossarySearchResult[] } {
  const byKey = new Map<string, GlossarySearchResult>();

  for (const group of groups) {
    for (const result of group.results) {
      const key = dedupeGlossaryKey(result.term, result.romanTransliteration);
      const existing = byKey.get(key);
      if (!existing || result.score > existing.score) {
        byKey.set(key, result);
      }
    }
  }

  const merged = [...byKey.values()].sort(
    (a, b) => b.score - a.score || a.term.localeCompare(b.term)
  );

  return {
    total: groups.reduce((sum, group) => sum + group.total, 0),
    results: merged.slice(0, limit),
  };
}
