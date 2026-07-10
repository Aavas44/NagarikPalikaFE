// @ts-ignore — package has no types
import {
  kantipurToUnicode,
  pcsToUnicode,
  preetiToUnicode,
} from "preeti2unicode/src/index";
import { applyWordFixes } from "./text-clean";

const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const PUA_AND_SYMBOLS = /[\uE000-\uF8FF\uF000-\uFFFF]/g;

export type LegacyFont = "auto" | "preeti" | "kantipur" | "pcs";

export function devanagariRatio(text: string): number {
  const matches = text.match(DEVANAGARI_RE);
  return (matches?.length ?? 0) / Math.max(text.length, 1);
}

export function convertLegacyFont(text: string): string {
  const kantipur = kantipurToUnicode(text);
  const preeti = preetiToUnicode(text);

  return devanagariRatio(kantipur) >= devanagariRatio(preeti)
    ? kantipur
    : preeti;
}

function convertWithFont(text: string, font: LegacyFont): string {
  switch (font) {
    case "preeti":
      return preetiToUnicode(text);
    case "kantipur":
      return kantipurToUnicode(text);
    case "pcs":
      return pcsToUnicode(text);
    case "auto":
    default:
      return convertLegacyFont(text);
  }
}

export function cleanMixedLegacy(text: string, font: LegacyFont = "auto"): string {
  if (/[a-zA-Z\[\]'/\\]{3,}/.test(text)) {
    const converted = convertWithFont(text, font);
    if (devanagariRatio(converted) >= devanagariRatio(text)) {
      return converted;
    }
  }
  return text;
}

/** Convert Preeti/Kantipur-encoded text (mixed with Unicode) to Devanagari. */
export function convertNepaliLegacyToUnicode(
  raw: string,
  font: LegacyFont = "auto"
): string {
  return raw
    .split("\n")
    .map((line) => {
      let converted = cleanMixedLegacy(line, font).replace(PUA_AND_SYMBOLS, " ");
      converted = applyWordFixes(converted);
      return converted.trimEnd();
    })
    .join("\n");
}

/** @deprecated Use convertNepaliLegacyToUnicode */
export function convertLegacyTextFile(raw: string): string {
  return convertNepaliLegacyToUnicode(raw, "auto");
}
