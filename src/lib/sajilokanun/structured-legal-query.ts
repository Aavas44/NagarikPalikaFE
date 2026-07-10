import { isProvisionTitleQuery } from "./provision-title-search";

/** Roman/English still in the query — must run through Gemini / transliteration. */
function hasRomanOrEnglishLeak(text: string): boolean {
  return (text.match(/[A-Za-z]{2,}/g) ?? []).length > 0;
}

/** True when the query is a दफा / section lookup (skip LLM translation and numeral normalization). */
export function isStructuredLegalQuery(query: string): boolean {
  const trimmed = query.trim();
  if (hasRomanOrEnglishLeak(trimmed)) return false;
  if (/^(?:dafa|sec)_[\w\u0900-\u097F]+$/i.test(trimmed)) return true;
  if (isProvisionTitleQuery(trimmed)) return true;
  return /(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*[\d०-९]+/i.test(
    trimmed
  );
}

export { isProvisionTitleQuery } from "./provision-title-search";
