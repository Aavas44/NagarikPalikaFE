import { getGemini, CHAT_MODEL, isQuotaError } from "./gemini";

export type WordChange = {
  from: string;
  to: string;
  reason: string;
};

export type GeminiCleanResult = {
  cleaned: string;
  changes: WordChange[];
  rejected: boolean;
  rejectReason?: string;
};

const SYSTEM_PROMPT = `You fix OCR and PDF extraction errors in Nepali legal text (Devanagari).

STRICT RULES — word-level only:
- Fix broken words: join incorrect spaces inside a word (e.g. "कानू न" → "कानून")
- Fix Latin/OCR artifacts inside words (e.g. "उपदफmा" → "उपदफा")
- Fix obvious single-word typos from font conversion (e.g. "जााच" → "जाँच", "तापिन" → "तापाई")
- Do NOT rephrase, summarize, or rewrite sentences
- Do NOT change word order
- Do NOT add, remove, or merge sentences
- Do NOT change numbers, दफा labels, उपदफा markers like (१), (२), or punctuation (।)
- Do NOT add commentary

Return JSON only with this exact shape:
{
  "cleaned_text": "the corrected Nepali text",
  "word_changes": [
    { "from": "broken fragment", "to": "corrected fragment", "reason": "join|typo|latin|spacing" }
  ]
}

If no changes needed, return cleaned_text identical to input and word_changes as [].`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isQuotaError(error) || attempt === maxAttempts) throw error;
      const waitMs = Math.min(2000 * 2 ** (attempt - 1), 60000);
      console.warn(`  Gemini rate limit on ${label}, retry in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
    }
  }
  throw new Error(`Failed ${label}`);
}

function parseGeminiJson(text: string): {
  cleaned_text: string;
  word_changes: WordChange[];
} {
  const trimmed = text.trim();
  const jsonStr = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) {
    throw new Error("No JSON object in Gemini response");
  }
  const parsed = JSON.parse(jsonStr) as {
    cleaned_text?: string;
    word_changes?: WordChange[];
  };
  if (typeof parsed.cleaned_text !== "string") {
    throw new Error("Missing cleaned_text in Gemini response");
  }
  return {
    cleaned_text: parsed.cleaned_text.trim(),
    word_changes: Array.isArray(parsed.word_changes) ? parsed.word_changes : [],
  };
}

function countDanda(text: string): number {
  return (text.match(/[\u0964\u0965।]/g) ?? []).length;
}

function countSubsections(text: string): number {
  return (text.match(/\([\d०-९]+\)/g) ?? []).length;
}

function extractSectionNumbers(text: string): string[] {
  return [...text.matchAll(/(?:^|[\s।])([\d०-९]{1,4})\./g)].map((m) => m[1]);
}

/** Reject if Gemini changed structure beyond word-level fixes */
export function validateWordLevelOnly(
  original: string,
  cleaned: string
): { ok: true } | { ok: false; reason: string } {
  if (!cleaned.trim()) {
    return { ok: false, reason: "empty output" };
  }

  const origDanda = countDanda(original);
  const cleanDanda = countDanda(cleaned);
  if (Math.abs(origDanda - cleanDanda) > 0) {
    return {
      ok: false,
      reason: `sentence count changed (। ${origDanda} → ${cleanDanda})`,
    };
  }

  const origSubs = countSubsections(original);
  const cleanSubs = countSubsections(cleaned);
  if (origSubs !== cleanSubs) {
    return {
      ok: false,
      reason: `subsection markers changed (${origSubs} → ${cleanSubs})`,
    };
  }

  const origSections = extractSectionNumbers(original);
  const cleanSections = extractSectionNumbers(cleaned);
  if (origSections.join(",") !== cleanSections.join(",")) {
    return { ok: false, reason: "section numbers changed" };
  }

  const lenRatio = cleaned.length / Math.max(original.length, 1);
  if (lenRatio < 0.88 || lenRatio > 1.12) {
    return {
      ok: false,
      reason: `length changed too much (${(lenRatio * 100).toFixed(0)}%)`,
    };
  }

  if (/[a-zA-Z]/.test(cleaned.replace(/p\.\d+/g, ""))) {
    return { ok: false, reason: "Latin characters remain in cleaned text" };
  }

  return { ok: true };
}

export async function cleanTextWithGemini(
  text: string,
  context?: { sectionLabel?: string | null; pageNumber?: number }
): Promise<GeminiCleanResult> {
  const contextLine = context?.sectionLabel
    ? `Context: दफा ${context.sectionLabel}, page ${context.pageNumber ?? "?"}`
    : "";

  const userPrompt = `${contextLine}

Fix ONLY word-level OCR/extraction errors in this Nepali legal text. Return JSON.

TEXT:
${text}`;

  const response = await withRetry(
    () =>
      getGemini().models.generateContent({
        model: CHAT_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    "cleanTextWithGemini"
  );

  const rawText = response.text ?? "";
  const { cleaned_text, word_changes } = parseGeminiJson(rawText);

  const validation = validateWordLevelOnly(text, cleaned_text);
  if (!validation.ok) {
    return {
      cleaned: text,
      changes: [],
      rejected: true,
      rejectReason: validation.reason,
    };
  }

  const validChanges = word_changes.filter(
    (c) =>
      c.from &&
      c.to &&
      c.from !== c.to &&
      text.includes(c.from) &&
      cleaned_text.includes(c.to)
  );

  return {
    cleaned: cleaned_text,
    changes: validChanges,
    rejected: false,
  };
}

export async function cleanTextWithGeminiBatched(
  texts: string[],
  contexts: ({ sectionLabel?: string | null; pageNumber?: number } | undefined)[],
  delayMs = 400
): Promise<GeminiCleanResult[]> {
  const results: GeminiCleanResult[] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(await cleanTextWithGemini(texts[i], contexts[i]));
    if (i + 1 < texts.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return results;
}
