import { finalizeNepaliQuestion, latinCount } from "./devanagari-text";
import { formatSourceLabel } from "./source-label";
import {
  parseChunkHierarchy,
  parseProvisionPath,
} from "./hierarchical-section";
import { cleanProvisionBodyForDisplay, getProvisionBody } from "./provision-body";
import { toArabicDigits } from "./nepali-digits";
import type { MatchedChunk } from "./supabase";

/** दफा shown in मिलापत्र + अदालती शुल्क फिर्ता answers. */
const MILAPATRA_VERBATIM_SECTIONS = new Set(["82", "248"]);

/**
 * Keep only the primary उपदफा (१) clause per दफा — excludes (२)+ and mis-indexed
 * "बमोजिम …" continuations that belong to the next उपदफा.
 */
export function filterMilapatraCourtFeeChunks(
  chunks: MatchedChunk[]
): MatchedChunk[] {
  return chunks.filter((chunk) => {
    const section = toArabicDigits(chunk.section_label?.split(".")[0] ?? "");
    if (!MILAPATRA_VERBATIM_SECTIONS.has(section)) return false;

    const hierarchy = parseChunkHierarchy(chunk.content);
    if (hierarchy.chunkType !== "upadafa") return false;

    const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
    const { path, text } = parseProvisionPath(body);
    const trimmed = text.trim();
    if (!trimmed || trimmed === "वा" || /^बमोजिम/u.test(trimmed)) return false;

    return path.length === 0 || path[0] === "१";
  });
}

function hasSection(chunks: MatchedChunk[], section: string): boolean {
  const arabic = section.replace(/[^\d]/g, "");
  return chunks.some(
    (c) => c.section_label?.split(".")[0]?.trim() === arabic
  );
}

function inlineSource(chunks: MatchedChunk[], section: string): string {
  const arabic = section.replace(/[^\d]/g, "");
  const chunk = chunks.find(
    (c) => c.section_label?.split(".")[0]?.trim() === arabic
  );
  if (!chunk) {
    return formatSourceLabel({
      filename: "lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
      section_label: section,
    });
  }
  return formatSourceLabel(
    {
      filename: chunk.filename,
      section_label: chunk.section_label,
      chapter: chunk.chapter,
      content: chunk.content,
    },
    { boldChapter: true }
  );
}

/** Deterministic **सारांश** for मिलापत्र + अदालती शुल्क फिर्ता (दफा ८२, २४८). */
export function buildMilapatraCourtFeeSaransh(
  chunks: MatchedChunk[]
): string {
  const s82 = inlineSource(chunks, "82");
  const lines = [
    "तपाईँले अदालतमा दर्ता गरेको मुद्दामा पक्षहरू मिलापत्र गर्दा तिरेको अदालती शुल्कको शेष रकम फिर्ता पाउनुहुन्छ।",
    "",
    `यदि मिलापत्र शुरु तहको अदालतमा प्रमाण बुझ्नु अघि भएको हो भने अदालती शुल्कको पच्चीस प्रतिशत मात्र लिइन्छ र बाँकी रकम फिर्ता गरिन्छ। यदि त्यसपछि वा अन्य तहमा मिलापत्र भएमा आधा अदालती शुल्क लिई बाँकी रकम फिर्ता गरिन्छ (स्रोत: ${s82})।`,
  ];

  if (hasSection(chunks, "248")) {
    const s248 = inlineSource(chunks, "248");
    lines.push(
      "",
      `फिर्ता पाउने ठहरिएको अदालती शुल्कको रकम फिर्ता माग गर्न सम्बन्धित अदालतमा एक वर्षभित्र निवेदन दिनु पर्छ (स्रोत: ${s248})।`
    );
  }

  return lines.join("\n");
}

export function buildMilapatraMuddha(queryNepali: string): string {
  return finalizeNepaliQuestion(queryNepali);
}

/**
 * खारेज / डिसमिस: only उपदफा (४) + the "तर …" exception under the same दफा.
 */
export function filterKharejCourtFeeChunks(
  chunks: MatchedChunk[]
): MatchedChunk[] {
  return chunks.filter((chunk) => {
    const section = toArabicDigits(chunk.section_label?.split(".")[0] ?? "");
    if (section !== "82") return false;

    const hierarchy = parseChunkHierarchy(chunk.content);
    if (hierarchy.chunkType === "tar") return true;

    if (hierarchy.chunkType !== "upadafa") return false;

    const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
    const { path, text } = parseProvisionPath(body);
    const trimmed = text.trim();
    if (!trimmed || /^बमोजिम/u.test(trimmed)) return false;

    return path[0] === "४" || hierarchy.upadafa === 4;
  });
}

/** Deterministic **सारांश** for खारेज + अदालती शुल्क फिर्ता (दफा ८२ उपदफा ४). */
export function buildKharejCourtFeeSaransh(chunks: MatchedChunk[]): string {
  const s82 = inlineSource(chunks, "82");
  return [
    "साधारणतया मुद्दा डिसमिस वा खारेज भएमा त्यस मुद्दाका लागि बुझाएको अदालती शुल्क फिर्ता हुँदैन।",
    "",
    `दफा ८२ को उपदफा (४) बमोजिम तिरेको अदालती शुल्क फिर्ता हुने छैन (स्रोत: ${s82})।`,
    "",
    "यद्यपि फिरादपत्रको लेखाइबाटै दर्ता हुन नसक्ने फिरादपत्र दर्ता भएको देखिएर मात्र खारेज भएको हो भने शुल्क फिर्ता हुन सक्छ — विवरण माथिको लागू प्रावधानमा उल्लेख छ।",
  ].join("\n");
}

export function buildKharejMuddha(
  queryNepali: string,
  originalQuestion?: string
): string {
  const raw =
    latinCount(queryNepali) > 0 && originalQuestion
      ? originalQuestion
      : queryNepali;
  return finalizeNepaliQuestion(raw);
}
