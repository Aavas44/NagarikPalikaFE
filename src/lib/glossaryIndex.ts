/** Client-safe Nepali alphabet index for Kanuni Shabdakosh browse. */

const MULTI_CHAR_INDEX = ["क्ष", "त्र", "ज्ञ"] as const;

export const NEPALI_INDEX_LETTERS = [
  "अ",
  "आ",
  "इ",
  "ई",
  "उ",
  "ऊ",
  "ऋ",
  "ए",
  "ऐ",
  "ओ",
  "औ",
  "क",
  "ख",
  "ग",
  "घ",
  "ङ",
  "च",
  "छ",
  "ज",
  "झ",
  "ञ",
  "ट",
  "ठ",
  "ड",
  "ढ",
  "ण",
  "त",
  "थ",
  "द",
  "ध",
  "न",
  "प",
  "फ",
  "ब",
  "भ",
  "म",
  "य",
  "र",
  "ल",
  "व",
  "श",
  "ष",
  "स",
  "ह",
  "क्ष",
  "त्र",
  "ज्ञ",
] as const;

export type NepaliIndexLetter = (typeof NEPALI_INDEX_LETTERS)[number];

export function getIndexLetter(term: string): string {
  const trimmed = term.trim();
  for (const multi of MULTI_CHAR_INDEX) {
    if (trimmed.startsWith(multi)) return multi;
  }
  return trimmed[0] ?? "";
}

export function isNepaliIndexLetter(value: string): value is NepaliIndexLetter {
  return (NEPALI_INDEX_LETTERS as readonly string[]).includes(value);
}
