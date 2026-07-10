import {
  attachNepaliPostpositions,
  ROMAN_WORDS,
  transliterateRomanNepali,
} from "./roman-nepali-transliterate";

export function latinCount(text: string): number {
  return (text.match(/[A-Za-z]/g) ?? []).length;
}

/** Convert Roman/English leaks to Devanagari for display and retrieval. */
export function ensureDevanagariText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || latinCount(trimmed) === 0) return trimmed;

  let out = trimmed.replace(/\b([A-Za-z]+)\b/g, (word) => {
    const mapped = ROMAN_WORDS[word.toLowerCase()];
    return mapped ?? word;
  });

  if (latinCount(out) > 0) {
    const transliterated = transliterateRomanNepali(trimmed);
    if (latinCount(transliterated) < latinCount(out)) {
      out = transliterated;
    }
  }

  return attachNepaliPostpositions(out);
}

/** Spacing + Devanagari cleanup for a displayed user question. */
export function finalizeNepaliQuestion(text: string): string {
  let out = ensureDevanagariText(text);
  out = out.replace(/पाइन्छकि/g, "पाइन्छ कि");
  out = out.replace(/पर्छकि/g, "पर्छ कि");
  out = out.replace(/([^\s])कि(?=\s*नै)/g, "$1 कि");
  out = out.replace(/\s*कि\s*नै/g, " कि नै");
  return out.replace(/\s+/g, " ").trim();
}

/** मुद्दा block: show only the user's question (drop advocate restatement after —). */
export function formatMuddhaSectionBody(body: string): string {
  const dash = body.indexOf(" — ");
  const question = dash >= 0 ? body.slice(0, dash).trim() : body.trim();
  return finalizeNepaliQuestion(question);
}
