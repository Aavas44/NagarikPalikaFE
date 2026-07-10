const TO_ARABIC: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

const TO_DEVANAGARI: Record<string, string> = {
  "0": "०", "1": "१", "2": "२", "3": "३", "4": "४",
  "5": "५", "6": "६", "7": "७", "8": "८", "9": "९",
};

export function toArabicDigits(s: string): string {
  return s.replace(/[०-९]/g, (c) => TO_ARABIC[c] ?? c);
}

export function toDevanagariDigits(s: string): string {
  return s.replace(/\d/g, (c) => TO_DEVANAGARI[c] ?? c);
}

/** Normalize any digit run to Devanagari (handles mixed 244 / २४४). */
export function toNepaliNumberDisplay(s: string): string {
  return toDevanagariDigits(toArabicDigits(s));
}

export function formatPageNepali(page: number | null | undefined): string | null {
  if (page == null) return null;
  return toDevanagariDigits(String(page));
}
