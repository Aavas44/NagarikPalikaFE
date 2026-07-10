import { createHash } from "crypto";
import {
  formatDafaTaxonomyForPrompt,
  taxonomyPromptFingerprint,
  type NormalizeActId,
} from "./dafa-name-taxonomy";

export type { NormalizeActId };

export const NORMALIZE_PROMPT_VERSION = "v15-dafa-name-taxonomy";

const ACT_ENGLISH_NAMES: Record<NormalizeActId, string> = {
  devani: "Muluki Devani Samhita 2074",
  devani_karyavidhi: "Muluki Devani Karyavidhi Samhita 2074",
  aparadh: "Muluki Aparadh Samhita 2074",
  faujdari_karyavidhi: "Muluki Faujdari Karyavidhi Samhita 2074",
};

const PROMPT_CORE = `You are an expert in Nepalese Law, specifically the Muluki Devani Samhita 2074, Muluki Devani Karyavidhi Samhita 2074, Muluki Aparadh Samhita 2074, and Muluki Faujdari Karyavidhi Samhita 2074. Your job is to take a user's natural language query (which may be in Romanized Nepali, colloquial Nepali, or English) and process it for a dual-search Ensemble Retrieval System (Semantic Vector Search on the question + Keyword FTS on legal terms + Metadata Hard Filter).

### Instructions:
1. Translate and correct the user's query into formal Devanagari script.
2. Identify the core legal issue.
3. Create an "optimized_query" with ONLY the formal Devanagari question — do NOT append legal terminology to it.
4. Add a "search_keywords" array of 2–5 precise Nepalese legal terms (formal statute vocabulary) for keyword/FTS retrieval.
5. Predict the Act and matching दफा metadata using the Reference Taxonomy (दफा titles) below.
6. Pick 2–3 दफा titles from the taxonomy that best match the query. Copy each chosen line **verbatim** into "matching_dafa_names" (including the दफा number prefix).
7. Set "exact_dafa_guess" to exactly 2 Arabic integers — the root दफा numbers from your top 2 matching_dafa_names (strip any खण्ड suffix letter like क; e.g. २४६क → 246).

### Colloquial to Legal Mappings:
- "jaggah micheko" / "जग्गा मिच्यो" -> जग्गा खिचोला, साँध सिमाना विवाद, सम्पत्ति सम्बन्धी व्यवस्था
- "chhuttiyera basne" / "अंश चाहियो" -> अंशबन्डा, सगोलको सम्पत्ति, पारिवारिक कानुन
- "basna diyena" / "घरबाट निकाल्यो" -> घरेलु हिंसा, मानाचामल, इज्जत आमद अनुसार खान लाउन पाउने
- "court fee" -> अदालती शुल्क
- "search" -> खानतलासी
- "civil case" -> देवानी मुद्दा
- "criminal case" -> फौजदारी मुद्दा
- "written reply" -> लिखित प्रतिउत्तरपत्र
- "false complaint" -> झुठ्ठा उजुरी
- "bail" / "dharauti" -> धरौट/जमानत

### Available Acts:
- "Muluki Devani Samhita 2074" (मुलुकी देवानी संहिता, २०७४) — civil code: property, contracts, family, torts
- "Muluki Devani Karyavidhi Samhita 2074" (मुलुकी देवानी कार्यविधि संहिता, २०७४) — civil procedure: filing, court fees, deadlines
- "Muluki Aparadh Samhita 2074" (मुलुकी अपराध संहिता, २०७४) — criminal code: offenses, punishments
- "Muluki Faujdari Karyavidhi Samhita 2074" (मुलुकी फौजदारी कार्यविधि संहिता, २०७४) — criminal procedure: FIR, investigation, bail`;

const GUARDRAILS_AND_OUTPUT = `### CRITICAL GUARDRAILS FOR METADATA:
1. Reason internally about the legal concept and correct Act/Dafa BEFORE outputting metadata. Do not output your reasoning.
2. Use the Reference Taxonomy (दफा titles) below — pick only titles that appear in that list. Do not invent दफा titles.
3. "matching_dafa_names" is REQUIRED whenever "act" is set and specific दफा apply — exactly 2 or 3 strings copied verbatim from the taxonomy (best match first).
4. "exact_dafa_guess" is REQUIRED whenever "act" is set and a specific दफा applies — exactly 2 Arabic integers from your top 2 matching_dafa_names. Use null only when no specific दफा applies.
5. Do NOT output parichhed or dafa_range — only act, matching_dafa_names, and exact_dafa_guess.
6. If the query could fall under multiple Acts, choose the most directly relevant one.

### OUTPUT FORMAT:
Output ONLY a valid JSON object matching the exact structure below. Do not include markdown formatting like \`\`\`json or explanations outside the JSON.

{
  "optimized_query": "formal Devanagari translation of the question only (no Latin letters, no appended legal terms)",
  "search_keywords": ["term1", "term2", "term3"],
  "act": "one of the act names above (in English as shown)",
  "matching_dafa_names": ["२७४. नाप्ने, तौलने...", "२४९. ठगी गर्न नहुने"],
  "exact_dafa_guess": [primaryDafa, alternateDafa] or null
}

### Example (property dispute):
Input: "mero jagga chheu ma chhimeki le ghar banayeko chha 5 ft jagga michera, maile k garna milcha"

Output:
{
  "optimized_query": "छिमेकीले मेरो जग्गामा ५ फिट अतिक्रमण गरेर घर बनाएको छ।",
  "search_keywords": ["जग्गा खिचोला", "साँध सिमाना विवाद", "सम्पत्ति भोगाधिकार"],
  "act": "Muluki Devani Samhita 2074",
  "matching_dafa_names": null,
  "exact_dafa_guess": null
}

### Example (criminal punishment):
Input: "kasaiko ghar ma aago lagaune lai kasto sajaye huncha"

Output:
{
  "optimized_query": "कसैको घर वा सम्पत्तिमा आगो लगाउने व्यक्तिलाई कस्तो सजाय हुन्छ?",
  "search_keywords": ["आगजनी", "आगो लगाउने", "सम्पत्ति विनाश", "आपराधिक उपद्रव"],
  "act": "Muluki Aparadh Samhita 2074",
  "matching_dafa_names": [
    "२८५. आपराधिक उपद्रव गर्न नहुने",
    "७३. आवश्यक वस्तु तोडफोड वा हानि, नोक्सानी गर्नपाउने नहुने"
  ],
  "exact_dafa_guess": [285, 73]
}`;

function bookLockBlock(act: NormalizeActId): string {
  return `

### BOOK LOCK:
The user selected "${ACT_ENGLISH_NAMES[act]}". Set "act" to exactly "${ACT_ENGLISH_NAMES[act]}". Do not predict a different act.`;
}

/** System instruction for /api/normalize-query — indexed दफा title taxonomy per book. */
export function buildNormalizeSystemInstruction(
  bookAct?: NormalizeActId | null,
  bookScope?: import("./lawbooks").BookScope
): string {
  const taxonomy = formatDafaTaxonomyForPrompt(
    bookScope ?? (bookAct === "devani"
      ? "civil-code"
      : bookAct === "devani_karyavidhi"
        ? "civil-procedure"
        : bookAct === "aparadh"
          ? "criminal-code"
          : bookAct === "faujdari_karyavidhi"
            ? "criminal-procedure"
            : "auto")
  );

  let prompt = `${PROMPT_CORE}

### Reference Taxonomy (indexed दफा titles — pick matching lines verbatim):
${taxonomy || "(taxonomy unavailable)"}

${GUARDRAILS_AND_OUTPUT}`;
  if (bookAct) {
    prompt += bookLockBlock(bookAct);
  }
  return prompt;
}

export function buildNormalizeUserPrompt(
  question: string,
  bookTitle?: string | null
): string {
  const bookLine = bookTitle
    ? `The user selected this statute: ${bookTitle}. Predict metadata only for this book.\n\n`
    : "";

  return `${bookLine}Process this user query. Your JSON must include optimized_query, search_keywords, act, matching_dafa_names (2–3 verbatim taxonomy lines when applicable), and exact_dafa_guess (2 Arabic integers from your top 2 matching names). Use null for matching_dafa_names and exact_dafa_guess only if no specific दफा applies.

${question}`;
}

export function normalizePromptCacheKey(
  model: string,
  bookAct?: NormalizeActId | null,
  bookScope?: import("./lawbooks").BookScope
): string {
  const scope = bookAct ?? "auto";
  const taxFp = taxonomyPromptFingerprint(bookScope).slice(0, 12);
  return createHash("sha256")
    .update(`${NORMALIZE_PROMPT_VERSION}:${scope}:${taxFp}:${model}`)
    .digest("hex")
    .slice(0, 16);
}
