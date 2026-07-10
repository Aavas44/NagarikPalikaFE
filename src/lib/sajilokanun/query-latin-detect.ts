/** Client-safe: true when query contains Roman/English that must go through Gemini first. */

export function hasLatinLetters(text: string): boolean {
  return (text.match(/[A-Za-z]/g) ?? []).length > 0;
}

/** Structured दफा lookup — skip Gemini preprocess. */
function isStructuredDafaLookup(text: string): boolean {
  const trimmed = text.trim();
  if (/^(?:dafa|sec)_[\w\u0900-\u097F]+$/i.test(trimmed)) return true;
  return (
    !hasLatinLetters(trimmed) &&
    /(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*[\d०-९]+/i.test(
      trimmed
    )
  );
}

/** Roman, English, or mixed Latin+Devanagari — normalize via Gemini before /chat. */
export function needsGeminiPreprocess(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || isStructuredDafaLookup(trimmed)) return false;
  return hasLatinLetters(trimmed);
}
