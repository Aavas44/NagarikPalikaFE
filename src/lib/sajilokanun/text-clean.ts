/** Clean legacy-font and PDF extraction artifacts from Nepali legal text. */

const PUA_AND_SYMBOLS = /[\uE000-\uF8FF\uF000-\uFFFF]/g;

const AMENDMENT_FOOTNOTE =
  /[\uF0B2]?\s*म\s*ु\s*ल\s*ु\s*क\s*ी[^।]*संशोध[^।]*[।]\s*/g;

const GARBAGE_RUNS =
  /ध+\s*ध+\s*।[^।]{0,80}?[mज्ञ][^।\s]{0,20}\s*/g;

const CIVIL_GARBAGE =
  /(?:^|\s)[mज्ञ]?\s*।नयख।लउ\s*ज्ञ?/g;

/** Standalone particles — do not merge with preceding fragment */
const MERGE_STOP_WORDS = new Set([
  "छ", "हो", "मा", "ले", "को", "का", "वा", "पनि", "गरी", "भए", "यो", "उन",
  "र", "त", "नै", "व", "क", "ह", "ज", "तर", "छैन", "हुन", "गर्न", "हुने",
  "हुन्छ", "भन्न", "गरे", "लागि", "अनुसार", "बमोजिम", "दफा", "उपदफा",
  "रहे", "भए", "गर्दा", "गरेमा", "भएमा", "हुने", "पर्छ", "सक्छ", "छन्",
]);

/** Common broken-word fixes from Preeti/Kantipur PDF extraction */
const WORD_FIXES: [RegExp, string][] = [
  [/कानू\s+न/g, "कानून"],
  [/होस\s+ठे/g, "होस् ठे"],
  [/जााच/g, "जाँच"],
  [/जाँच\s*बुझ/g, "जाँचबुझ"],
  [/आकृ\s*ित/g, "आकृति"],
  [/तस्वी\s*र/g, "तस्वीर"],
  [/तस्वीरि\s*खचे/g, "तस्वीर खिचे"],
  [/फ्राथ\s*मिक/g, "प्राथमिक"],
  [/फ्राथ/g, "प्राथ"],
  [/तापिन/g, "तापाई"],
  [/पिन\s+क/g, "तापाई क"],
  [/वदनिय\s*त/g, "वास्तविक"],
  [/वदनिय/g, "वास्तव"],
  [/खण्\s+ड/g, "खण्ड"],
  [/साास्कृतिक/g, "सांस्कृतिक"],
  [/साा\s+स्कृतिक/g, "सांस्कृतिक"],
  [/सम्झनु\s*पछर्/g, "सम्झनु पर्छ"],
  [/प्रावधानहरुृ/g, "प्रावधानहरू"],
  [/संहतिा/g, "संहिता"],
  [/केीि/g, "केही"],
  [/नेफाल/g, "नेपाल"],
  [/गने/g, "गर्ने"],
  [/संशोधधत/g, "संशोधित"],
  [/व्यत्ति/g, "व्यक्ति"],
  [/व्यित्त/g, "व्यक्ति"],
  [/रिस\s+इबि/g, "रिसइबी"],
  [/फरिच्छेद/g, "परिच्छेद"],
  [/सम्झनुस\s*म्झनुप\s*छर्नि/g, "सम्झनु पर्छ"],
  [/सम्झनुस\s*म्झनुप\s*छर्/g, "सम्झनु पर्छ"],
  [/फिरादपत्रस\s*म्झनुप\s*छर्?/g, "फिरादपत्र सम्झनु पर्छ"],
  [/नलागेमायस\s*संहितामा/g, "नलागेमा यस संहितामा"],
  [/नलागेमायस\s*ऐनमा/g, "नलागेमा यस ऐनमा"],
  [/कानूनीहक/g, "कानूनी हक"],
  [/रसो\s+शब्द/g, "र सो शब्द"],
  [/सोसाग/g, "सँग"],
  [/नामनि\s*धार्रण\s*प्रारम्भ/g, "नाम र प्रारम्भ"],
  [/धार्रणसो\s*शब्दले/g, " र सो शब्दले"],
  [/सुनुवाईनि\s*धार्रण/g, " सुनुवाइ"],
  [/जनाउाछ/g, "जनाउँछ"],
  [/न्\s+यायिक/g, " न्यायिक"],
  [/बमोिजम/g, "बमोजिम"],
  [/अिधकार/g, "अधिकार"],
  [/आफ्\s*नो/g, "आफ्नो"],
  [/विपरी\s*त/g, "विपरीत"],
  [/सिद्धान्\s*त/g, "सिद्धान्त"],
  [/उपदफ\s*mा/g, "उपदफा"],
  [/उपदफm/g, "उपदफ"],
  [/([\u0900-\u097F])m([\u093E-\u094B])/g, "$1$2"],
  [/([\u0900-\u097F])m(?=[\u0900-\u097F])/g, "$1"],
  [/m([\u0900-\u097F])/g, "$1"],
  [/हु\s*ा\s*दैन/g, "हुँदैन"],
  [/हु\s*ने/g, "हुने"],
  [/हुँ\s*दै/g, "हुँदै"],
  [/हुँ\s*दा/g, "हुँदा"],
  [/गरि\s*द/g, "गरिद"],
  [/न\s*रहे/g, "नरहे"],
  [/न\s*पाउ/g, "नपाउ"],
  [/न\s*गरे/g, "नगरे"],
  [/न\s*हु/g, "नहु"],
  [/न\s*पर्न/g, "नपर्न"],
  [/न\s*गर्न/g, "नगर्न"],
  [/न\s*लाग/g, "नलाग"],
];

/** Kantipur/Preeti partial conversion artifacts in karyavidhi PDF */
export function fixKaryavidhiOcrArtifacts(text: string): string {
  let result = text
    .replace(/(?<![\u0900-\u097F])\u0906\s*\u092B\u094D\u0928\u094B\u0906\s*\u092B\u094D\u0928\u094B/g, "\u0906\u092B\u094D\u0928\u094B")
    .replace(/\u092B\u094D\u0928\u094B\u0906\s*\u092B\u094D\u0928\u094B/g, " \u0906\u092B\u094D\u0928\u094B");

  result = result
    .replace(/([\u0900-\u097F]+)(?:\u0906|\u093E)\s+\u0906\u092B\u094D\u0928\u094B/g, "$1 \u0906\u092B\u094D\u0928\u094B")
    .replace(/([\u0900-\u097F]+)(?:\u0906|\u093E)\u0906\u092B\u094D\u0928\u094B/g, "$1 \u0906\u092B\u094D\u0928\u094B")
    .replace(/\u0906\u0927\u093E\u0930\u0928\u093F\s*\u0927\u093E\u0930\u094D\u0930\u0923/g, "\u0906\u0927\u093E\u0930 \u0930")
    .replace(/([\u0900-\u097F]+)\u0928\u093F\s*\u0927\u093E\u0930\u094D\u0930\u0923/g, "$1 \u0930")
    .replace(/\u0927\u093E\u0930\u094D\u0930\u0923/g, " \u0930 ")
    .replace(/\s+\u0930\s+\u0930\s+/g, " \u0930 ");

  return result;
}

export function fixSpacedDevanagari(text: string): string {
  let result = text;
  for (let i = 0; i < 8; i++) {
    const next = result.replace(
      /([\u0900-\u097F])\s+([\u093A-\u094F\u0951-\u0957])/g,
      "$1$2"
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

/** Merge PDF line-break spaces inside words (e.g. "कानू न" → "कानून") */
export function fixInternalWordSpaces(text: string): string {
  let result = text;
  for (let i = 0; i < 6; i++) {
    const next = result.replace(
      /([\u0900-\u097F]{2,})\s+([\u0900-\u097F]{1,2})(?=[\s\u0964\u0965,.;:)|]|$)/g,
      (match, left: string, right: string) =>
        MERGE_STOP_WORDS.has(right) ? match : left + right
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

export function applyWordFixes(text: string): string {
  let result = text;
  for (const [pattern, replacement] of WORD_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function removeDuplicateWords(text: string): string {
  return text.replace(/\b([\u0900-\u097F]+)\s+\1\b/g, "$1");
}

export function cleanNepaliText(text: string): string {
  let result = text
    .replace(PUA_AND_SYMBOLS, " ")
    .replace(AMENDMENT_FOOTNOTE, " ")
    .replace(GARBAGE_RUNS, " ")
    .replace(CIVIL_GARBAGE, " ");

  result = fixSpacedDevanagari(result);
  result = fixInternalWordSpaces(result);
  result = fixKaryavidhiOcrArtifacts(result);
  result = fixLatinOcrArtifacts(result);
  result = applyWordFixes(result);
  result = removeDuplicateWords(result);

  result = result
    .replace(/\u0964\s*\u0964/g, "।")
    .replace(/(\.\s*)(\d+\.)/g, "$1 $2")
    .replace(/([\u0964।])(\d+\.)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return result;
}

import {
  isMetadataLine,
  normalizeAnswerMetadata,
} from "./format-legal-answer";
import { fixLatinOcrArtifacts } from "./latin-ocr-fix";
import {
  dedupeAnswerSectionHeadings,
  normalizeAdvocateSourceLines,
} from "./provision-body";
import { polishAdvocateAnswerSections } from "./polish-advocate-text";

/** OCR/grammar cleanup for displayed LLM answers — preserves newlines for list layout. */
export function cleanAnswerDisplay(text: string): string {
  if (!text.trim()) return text;

  let normalized = text.includes("**सारांश**")
    ? polishAdvocateAnswerSections(text)
    : text;
  normalized = normalizeAdvocateSourceLines(normalized);
  normalized = dedupeAnswerSectionHeadings(normalized);
  normalized = normalizeAnswerMetadata(normalized);

  return normalized
    .split("\n")
    .filter((line) => !/^पृष्ठ\s*:/.test(line.trim()))
    .map((line) => {
      if (!line.trim()) return line;

      if (isMetadataLine(line)) {
        return line.replace(/[ \t]+/g, " ").trimEnd();
      }

      let result = line
        .replace(PUA_AND_SYMBOLS, " ")
        .replace(AMENDMENT_FOOTNOTE, " ")
        .replace(GARBAGE_RUNS, " ")
        .replace(CIVIL_GARBAGE, " ");

      result = fixSpacedDevanagari(result);
      result = fixInternalWordSpaces(result);
      result = fixKaryavidhiOcrArtifacts(result);
      result = fixLatinOcrArtifacts(result);
      result = applyWordFixes(result);
      result = removeDuplicateWords(result);

      return result
        .replace(/\u0964\s*\u0964/g, "।")
        .replace(/[ \t]+/g, " ")
        .trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function excerptAroundQuery(
  content: string,
  query: string,
  maxLength = 500
): string {
  const words = query
    .split(/[\s,।.?!;:]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);

  let bestIndex = 0;
  let bestScore = -1;

  for (const word of words) {
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf(word, searchFrom);
      if (idx === -1) break;
      const score = words.filter((w) => {
        const start = Math.max(0, idx - 200);
        const end = Math.min(content.length, idx + 200);
        return content.slice(start, end).includes(w);
      }).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
      searchFrom = idx + 1;
    }
  }

  const half = Math.floor(maxLength / 2);
  const start = Math.max(0, bestIndex - half);
  const end = Math.min(content.length, start + maxLength);
  const excerpt = content.slice(start, end).trim();

  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return `${prefix}${excerpt}${suffix}`;
}
