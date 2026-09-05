import { completeChat, resolveDocumentGenerationModel } from "@/lib/sajilokanun/ai";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import type { WardTemplateVariable } from "@/lib/ward-access";

const LATIN_RE = /[A-Za-z]/;
const ASCII_DIGIT_RE = /\d/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WARD_LOCALIZE_SYSTEM_PROMPT = `You localize ward office (वडा कार्यालय) document template field values into formal Nepali (Devanagari) for official municipal paperwork.

Rules:
- Respond with ONLY a valid JSON object mapping each input field key to its localized string value.
- Write ALL text in Devanagari Nepali. Do not leave English words except unavoidable Latin proper nouns when transliteration would be misleading.
- Personal names in Roman script: transliterate to Devanagari (do not translate meaning).
- Addresses, relations, subjects, reasons, descriptions, and titles: translate to formal Nepali administrative language.
- Phone, citizenship, ward, and ID numbers: use Devanagari digits (०१२३...) while preserving the same digit sequence.
- ISO dates (YYYY-MM-DD): convert to Nepali Bikram Sambat long form, e.g. "२०८२ साल फागुन १५ गते".
- If input is already in Devanagari Nepali, return polished formal Nepali (minor grammar fixes only).
- Preserve line breaks and list structure inside multi-line values.
- Include every key from the input. Do not add or remove keys.
- Do not wrap JSON in markdown fences.`;

export type WardLocalizeField = Pick<
  WardTemplateVariable,
  "key" | "type" | "label"
>;

export type WardLocalizeResult = {
  variables: Record<string, string>;
  /** True when at least one field was sent to the LLM. */
  usedAi: boolean;
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function localNumericValue(value: string): string {
  return toDevanagariDigits(value.trim());
}

/** Convert leftover ASCII digits after AI / for digit-only fields. */
function applyDevanagariDigitsIfNeeded(value: string): string {
  if (!ASCII_DIGIT_RE.test(value)) return value;
  return localNumericValue(value);
}

function fieldNeedsAi(field: WardLocalizeField, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (field.type === "number") return LATIN_RE.test(trimmed);
  if (field.type === "date") {
    return ISO_DATE_RE.test(trimmed) || LATIN_RE.test(trimmed);
  }
  return LATIN_RE.test(trimmed);
}

export function isWardAiLocalizeEnabled(): boolean {
  const flag = process.env.WARD_AI_LOCALIZE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off" || flag === "no") {
    return false;
  }
  return true;
}

export function resolveWardLocalizeModel(): string {
  return (
    process.env.WARD_LOCALIZE_MODEL?.trim() ||
    process.env.DOCUMENT_GENERATION_MODEL?.trim() ||
    resolveDocumentGenerationModel()
  );
}

/**
 * Localize template user-field values. Only `userFields` keys are considered for
 * AI / digit conversion; other keys in `values` are passed through unchanged.
 */
export async function localizeWardUserVariables(
  userFields: WardLocalizeField[],
  values: Record<string, string>
): Promise<WardLocalizeResult> {
  if (!isWardAiLocalizeEnabled() || userFields.length === 0) {
    return { variables: values, usedAi: false };
  }

  const localized: Record<string, string> = { ...values };
  const aiFields: Array<{
    key: string;
    type: WardLocalizeField["type"];
    label: string;
    value: string;
  }> = [];

  for (const field of userFields) {
    const raw = values[field.key];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (!fieldNeedsAi(field, trimmed)) {
      // Digits-only / already-Nepali: convert ASCII digits locally, no LLM.
      localized[field.key] = applyDevanagariDigitsIfNeeded(trimmed);
      continue;
    }

    aiFields.push({
      key: field.key,
      type: field.type,
      label: field.label.ne || field.label.en || field.key,
      value: trimmed,
    });
  }

  if (aiFields.length === 0) {
    return { variables: localized, usedAi: false };
  }

  const userPrompt = JSON.stringify({ fields: aiFields }, null, 2);
  const model = resolveWardLocalizeModel();
  const raw = await completeChat(
    WARD_LOCALIZE_SYSTEM_PROMPT,
    userPrompt,
    model,
    "narrative"
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse Nepali localization response from AI");
  }

  for (const field of aiFields) {
    const next = parsed[field.key];
    if (typeof next !== "string") continue;
    const trimmed = next.trim();
    if (!trimmed) continue;
    localized[field.key] = applyDevanagariDigitsIfNeeded(trimmed);
  }

  return { variables: localized, usedAi: true };
}
