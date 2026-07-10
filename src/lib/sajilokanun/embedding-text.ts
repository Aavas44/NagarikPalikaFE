import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";
import { cleanNepaliText } from "./text-clean";

/** Word boundary so "upadafa 1" is not treated as "dafa 1". */
const DAFA_REF =
  /(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*([\d०-९]+(?:\.[\d०-९]+)?)/gi;

/** Normalize दफा / section number references to Devanagari numerals. */
export function normalizeLegalNumerals(text: string): string {
  return text.replace(DAFA_REF, (_match, num: string) => {
    return `दफा ${toNepaliNumberDisplay(toArabicDigits(num))}`;
  });
}

/**
 * Canonical text form for embedding — same pipeline for ingest chunks and queries.
 * Stored chunk content is unchanged; this runs only at embed time (and on queries for retrieval).
 */
export function normalizeForEmbedding(text: string): string {
  if (!text.trim()) return text;
  const cleaned = cleanNepaliText(text);
  return normalizeLegalNumerals(cleaned);
}

/** Enrich advocate retrieval queries with act + intent for better vector match. */
export function buildAdvocateEmbedQuery(
  query: string,
  options: {
    preferredAct?: string;
    intent?: string;
    legalIssues?: string[];
  } = {}
): string {
  const parts: string[] = [];
  if (options.preferredAct) {
    parts.push(`[${options.preferredAct}]`);
  }
  if (options.intent?.trim()) {
    parts.push(options.intent.trim());
  }
  parts.push(query.trim());
  if (options.legalIssues?.length) {
    parts.push(options.legalIssues.slice(0, 3).join(" "));
  }
  return normalizeForEmbedding(parts.join(" ").slice(0, 6000));
}

export function embeddingTextChanged(before: string, after: string): boolean {
  return before.trim() !== after.trim();
}
