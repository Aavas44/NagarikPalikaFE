/**
 * Search helpers for Nepali form titles: Devanagari substring match and
 * romanized-Nepali token match (e.g. "tarikh sakar gari paun" → तारिख सकार गरी पाऊ).
 */

const DEVANAGARI_INDEPENDENT_VOWELS: Record<string, string> = {
  अ: "a",
  आ: "aa",
  इ: "i",
  ई: "ii",
  उ: "u",
  ऊ: "uu",
  ऋ: "ri",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
  अं: "am",
  अः: "ah",
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "ng",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "ny",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
  क्ष: "ksh",
  त्र: "tr",
  ज्ञ: "gy",
};

const DEVANAGARI_MATRAS: Record<string, string> = {
  "ा": "aa",
  "ि": "i",
  "ी": "ii",
  "ु": "u",
  "ू": "uu",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ं": "n",
  "ँ": "n",
  "ः": "h",
};

/** Collapse common roman spelling variants for search. */
export function normalizeRomanSearchKey(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0900-\u097F]/g, " ") // drop leftover Devanagari if mixed
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/chh/g, "ch")
    .replace(/\bw\b/g, "v")
    .replace(/([a-z])w([a-z])/g, "$1v$2")
    .replace(/aa/g, "a")
    .replace(/ii/g, "i")
    .replace(/uu/g, "u")
    .replace(/ee/g, "e")
    .replace(/oo/g, "o")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rough Devanagari → roman for search (not for display).
 * Enough for court-form titles like तारिख सकार गरी पाऊ.
 */
export function romanizeDevanagariForSearch(text: string): string {
  let out = "";
  const chars = Array.from(text.normalize("NFKC"));
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;
    const next = chars[i + 1];

    if (/\s/.test(ch)) {
      out += " ";
      continue;
    }
    if (/[0-9]/.test(ch)) {
      out += ch;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }

    if (DEVANAGARI_INDEPENDENT_VOWELS[ch]) {
      out += DEVANAGARI_INDEPENDENT_VOWELS[ch];
      continue;
    }

    // conjunct glyphs stored as single keys
    if (DEVANAGARI_CONSONANTS[ch]) {
      const base = DEVANAGARI_CONSONANTS[ch]!;
      if (next === "्") {
        out += base;
        i += 1;
        continue;
      }
      if (next && DEVANAGARI_MATRAS[next]) {
        out += base + DEVANAGARI_MATRAS[next];
        i += 1;
        continue;
      }
      out += `${base}a`;
      continue;
    }

    if (DEVANAGARI_MATRAS[ch]) {
      out += DEVANAGARI_MATRAS[ch];
      continue;
    }

    if (ch === "्") continue;
    // punctuation / unknown → space
    out += " ";
  }

  return normalizeRomanSearchKey(out);
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.length > 3 && token.endsWith("n")) {
    variants.add(token.slice(0, -1));
  }
  if (token.length > 2 && !token.endsWith("n")) {
    variants.add(`${token}n`);
  }
  // paun / pau / paau already collapsed via normalize
  return [...variants].filter((v) => v.length >= 2);
}

function romanTokensMatch(queryRoman: string, haystackRoman: string): boolean {
  const tokens = queryRoman.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const compact = haystackRoman.replace(/\s+/g, "");
  return tokens.every((token) =>
    tokenVariants(token).some(
      (variant) =>
        haystackRoman.includes(variant) || compact.includes(variant)
    )
  );
}

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * True when `query` matches any of the provided title fields in Nepali or roman Nepali.
 */
export function matchesNepaliRomanSearch(
  query: string,
  fields: Array<string | null | undefined>
): boolean {
  const raw = query.trim();
  if (!raw) return true;

  const values = fields
    .map((field) => (field ?? "").trim())
    .filter(Boolean);
  if (values.length === 0) return false;

  const rawLower = raw.toLowerCase();

  // Direct Devanagari / Latin substring against original fields
  if (
    values.some((value) => value.toLowerCase().includes(rawLower))
  ) {
    return true;
  }

  // Token-wise Devanagari: every query token appears in some Nepali field
  if (hasDevanagari(raw)) {
    const nepaliTokens = raw.split(/\s+/).filter(Boolean);
    if (
      nepaliTokens.every((token) =>
        values.some((value) => value.includes(token))
      )
    ) {
      return true;
    }
  }

  const queryRoman = normalizeRomanSearchKey(
    hasDevanagari(raw) ? romanizeDevanagariForSearch(raw) : raw
  );
  if (!queryRoman) return false;

  const haystackRoman = normalizeRomanSearchKey(
    values.map((value) => romanizeDevanagariForSearch(value)).join(" ")
  );

  if (haystackRoman.includes(queryRoman)) return true;
  return romanTokensMatch(queryRoman, haystackRoman);
}
