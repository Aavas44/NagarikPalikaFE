import { createHash } from "crypto";
import {
  formatDafaTaxonomyForPrompt,
  taxonomyPromptFingerprint,
  type NormalizeActId,
} from "./dafa-name-taxonomy";

export type { NormalizeActId };

export const NORMALIZE_PROMPT_VERSION = "v31-logical-conclusion";

const ACT_ENGLISH_NAMES: Record<NormalizeActId, string> = {
  devani: "Muluki Devani Samhita 2074",
  devani_karyavidhi: "Muluki Devani Karyavidhi Samhita 2074",
  aparadh: "Muluki Aparadh Samhita 2074",
  faujdari_karyavidhi: "Muluki Faujdari Karyavidhi Samhita 2074",
};

const COLOQUIAL_MAPPINGS = `### Colloquial to Legal Mappings:
- "jaggah micheko" / "जग्गा मिच्यो" -> जग्गा खिचोला, साँध सिमाना विवाद, सम्पत्ति सम्बन्धी व्यवस्था
- "chhuttiyera basne" / "अंश चाहियो" -> अंशबन्डा, सगोलको सम्पत्ति, पारिवारिक कानुन
- "basna diyena" / "घरबाट निकाल्यो" -> घरेलु हिंसा, मानाचामल, इज्जत आमद अनुसार खान लाउन पाउने
- "court fee" -> अदालती शुल्क
- "search" -> खानतलासी
- "civil case" -> देवानी मुद्दा
- "criminal case" -> फौजदारी मुद्दा
- "written reply" -> लिखित प्रतिउत्तरपत्र
- "false complaint" -> झुठ्ठा उजुरी
- "bail" / "dharauti" -> धरौट/जमानत`;

const PROMPT_CORE = `You are an expert Nepalese Legal AI Classifier specializing in the four fundamental Muluki Codes (2074). 
Your task is to take a user's natural language query (which may be in Romanized Nepali, colloquial Nepali, or English) and accurately map it to the precise governing act and specific section (दफा) for a dual-search Ensemble Retrieval System.

### Core Objectives:
1. Normalize and translate the user input into a clean, formal, error-free Devanagari legal question.
2. Isolate 2 to 5 highly specific legal keywords (FTS tokens) in formal Devanagari.
3. Determine the correct governing Act and pinpoint the exact matching sections (दफा).

${COLOQUIAL_MAPPINGS}

### Legal Concept Disambiguation (Crucial for Context):
- **Partition vs. Lifecycle Settlement:** General partition (अंशबन्डा) applies to standard family separation. If property division is triggered by Divorce (सम्बन्ध विच्छेद), Death (अपुताली), or Second Marriage (बहुविवाह), it is exclusively governed by the specific settlement rules of that triggering event, not the general partition chapter. E.g. property in divorce is explicitly governed by Dafa 99.
- **Offense vs. Compensation:** Criminal offenses (e.g., Rape, Theft) define the crime. Claims for victim compensation (क्षतिपूर्ति) are often governed by separate compensation-specific provisions.
- **Direct vs. Derivative Rights:** A wife claiming property directly from her husband is a direct right. A daughter-in-law claiming from her father-in-law is a derivative right evaluated based on the husband's hypothetical share.

### Governing Statutes Reference:
- "Muluki Devani Samhita 2074" (मुलुकी देवानी संहिता, २०७४) — Substantive civil matters (Property, contracts, family, torts).
- "Muluki Devani Karyavidhi Samhita 2074" (मुलुकी देवानी कार्यविधि संहिता, २०७४) — Procedural civil matters (Filings, court fees, deadlines, limitations).
- "Muluki Aparadh Samhita 2074" (मुलुकी अपराध संहिता, २०७४) — Substantive criminal matters (Offenses, public nuisance, theft, punishments).
- "Muluki Faujdari Karyavidhi Samhita 2074" (मुलुकी फौजदारी कार्यविधि संहिता, २०७४) — Procedural criminal matters (FIR, investigation, arrest warrants, bail).`;

const SLIM_GUARDRAILS_AND_OUTPUT = `### CRITICAL EXECUTION RULES:
1. FILL OUT THE "legal_analysis_workspace" FIRST. Document your step-by-step reasoning about the legal nature of the dispute, identify the governing statute, and evaluate the specific section context before setting the final parameters.
2. In "matching_dafa_names", provide 1–3 likely sections (prefer fewer when precise). **CRITICAL: In Slim Mode, you do not have a reference taxonomy. If you do not know the exact section title and number by heart, you MUST output null.** Do not guess generic section numbers. It is much better to output null and provide excellent search_keywords than to hallucinate a wrong number. Use Devanagari digits for the numbers if you do provide them.
3. In "exact_dafa_guess", map your matching_dafa_names selections into absolute Arabic integers (e.g., २८५ becomes 285). **CRITICAL: If matching_dafa_names is null, this MUST be null.** Do not guess section numbers.
4. **Act ↔ दफा consistency (mandatory):** Every matching_dafa_names entry MUST be a provision that actually exists under the "act" you chose. The same दफा number is NOT shared across statutes — e.g. Devani १७५ (धर्मपुत्र) ≠ Aparadh १७५ (बहुविवाह). If the शीर्षक belongs to another Muluki code, change "act" to that code. Never pair an offense title (अपराध/सजाय) with Devani/Devani Karyavidhi, or a civil property/family title with Aparadh, unless that title truly is in that act.
5. exact_dafa_guess numbers MUST equal the leading दफा numbers in matching_dafa_names, in the same order, and MUST refer to those titles under the chosen act — do not invent extra numbers from other acts.
6. **SPECIFIC OVER GENERAL (Lex Specialis):** When a query combines a specific triggering event (e.g., Divorce, Death, Second Marriage) with a general legal concept (e.g., Partition, Custody, Compensation), prioritize the specific rules nested within the triggering event's chapter. General, standalone chapters covering the concept must be avoided. The specific contextual rule always overrides the general rule.
7. **COMPLEX CLAIMS & CONSEQUENCES:** If a query asks about an action/offense AND its consequence (e.g., punishment, property claim, compensation), provide sections for BOTH the primary action and the specific consequence if the statute separates them.
8. **DERIVATIVE RIGHTS:** When a query involves claiming rights through an intermediary (e.g., a daughter-in-law claiming from a father-in-law through her husband), bypass direct entitlement clauses. Target the clauses that evaluate hypothetical or indirect shares.
9. **CONTRASTIVE FILTERING & TRAP AVOIDANCE:** Aggressively identify trap sections that match literal search terms but belong to the wrong contextual framework. For example, general "Partition" sections are traps for a "Divorce Partition" query; general "Property" sections are traps for "Inheritance" queries. Banish all such context-mismatched trap sections into excluded_dafa_guess. Do not put the same number in both exact_dafa_guess and excluded_dafa_guess. Use [] when there are no clear traps.

### EXPECTED OUTPUT FORMAT:
Output ONLY a single valid JSON object following this scheme. Do NOT wrap your output in markdown code blocks like \`\`\`json or add text outside the object.

{
  "legal_analysis_workspace": "Detailed look-up tracing matching input text to the estimated legal concepts and Act selection.",
  "optimized_query": "Formal error-free Devanagari translation of the question only (No English/Latin words, no legal jargon appended to the end)",
  "search_keywords": ["शब्द१", "शब्द२", "शब्द३"],
  "act": "Exactly one of the four English Act names listed above",
  "matching_dafa_names": ["दफा ७३. आवश्यक वस्तु तोडफोड वा हानि, नोक्सानी गर्नपाउने नहुने ः"],
  "exact_dafa_guess": [73],
  "excluded_dafa_guess": [206, 227]
}`;

const LEGACY_GUARDRAILS_AND_OUTPUT = `### CRITICAL EXECUTION RULES:
1. FILL OUT THE "legal_analysis_workspace" FIRST. Scan the provided Reference Taxonomy index. Document which parts of the index match the user's intent and justify your choice before selecting the matching strings.
2. In "matching_dafa_names", you MUST copy exactly 2 to 3 lines from the Reference Taxonomy section provided below. Do not paraphrase, alter, or invent text. Copy them verbatim.
3. In "exact_dafa_guess", extract the leading numerals from your matching taxonomy selections and convert them into pure Arabic integers (e.g., if taxonomy says "२४९. ठगी...", extract 249). Use null only if no specific entry matches.
4. **Act ↔ taxonomy consistency:** Copy lines only from the Reference Taxonomy block that belongs to the "act" you set. Exact_dafa_guess must match those copied lines' numbers. Do not mix a line from one statute's taxonomy with another statute's "act" name.
5. **SPECIFIC OVER GENERAL (Lex Specialis):** When a query combines a specific triggering event (e.g., Divorce, Death, Second Marriage) with a general legal concept (e.g., Partition, Custody, Compensation), prioritize the specific rules nested within the triggering event's chapter. General, standalone chapters covering the concept must be avoided. The specific contextual rule always overrides the general rule.
6. **COMPLEX CLAIMS & CONSEQUENCES:** If a query asks about an action/offense AND its consequence (e.g., punishment, property claim, compensation), provide sections for BOTH the primary action and the specific consequence if the statute separates them.
7. **DERIVATIVE RIGHTS:** When a query involves claiming rights through an intermediary (e.g., a daughter-in-law claiming from a father-in-law through her husband), bypass direct entitlement clauses. Target the clauses that evaluate hypothetical or indirect shares.
8. **CONTRASTIVE FILTERING & TRAP AVOIDANCE:** Aggressively identify trap sections that match literal search terms but belong to the wrong contextual framework. For example, general "Partition" sections are traps for a "Divorce Partition" query; general "Property" sections are traps for "Inheritance" queries. Banish all such context-mismatched trap sections into excluded_dafa_guess. Do not put the same number in both exact_dafa_guess and excluded_dafa_guess. Use [] when there are no clear traps.

### EXPECTED OUTPUT FORMAT:
Output ONLY a single valid JSON object following this scheme. Do NOT wrap your output in markdown code blocks like \`\`\`json or add text outside the object.

{
  "legal_analysis_workspace": "Detailed look-up tracing matching input text to the provided taxonomy terms.",
  "optimized_query": "Formal error-free Devanagari translation of the question only (No English/Latin words, no legal jargon appended to the end)",
  "search_keywords": ["शब्द१", "शब्द२", "शब्द३"],
  "act": "Exactly one of the four English Act names listed above",
  "matching_dafa_names": ["२४९. ठगी गर्न नहुने", "२५०. आपराधिक विश्वासघात गर्न नहुने"],
  "exact_dafa_guess": [249, 250],
  "excluded_dafa_guess": [206, 227]
}`;

function bookLockBlock(act: NormalizeActId): string {
  return `

### MANDATORY SYSTEM CONSTRAINT:
The application context has explicitly locked this transaction to "${ACT_ENGLISH_NAMES[act]}". You MUST set "act" to exactly "${ACT_ENGLISH_NAMES[act]}". Do not map or guess any other statute name.`;
}

/** Slim prompt (default): no taxonomy in system instruction — दफा names reconciled locally after LLM. */
export function useSlimNormalizePrompt(): boolean {
  const flag = process.env.QUERY_NORMALIZE_SLIM?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function normalizeSemanticCacheKey(options: {
  bookAct?: NormalizeActId | null;
  bookScope?: import("./lawbooks").BookScope;
} = {}): string {
  const slim = useSlimNormalizePrompt();
  const scopePart = slim
    ? "slim"
    : taxonomyPromptFingerprint(options.bookScope).slice(0, 12);
  const hashInput = `${NORMALIZE_PROMPT_VERSION}:${options.bookAct ?? "auto"}:${scopePart}`;
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 12);
  const label = options.bookAct ?? "auto";
  return `handyLaw-normalize-${label}-${hash}`;
}

/** System instruction for query normalization (slim by default). */
export function buildNormalizeSystemInstruction(
  bookAct?: NormalizeActId | null,
  bookScope?: import("./lawbooks").BookScope
): string {
  const slim = useSlimNormalizePrompt();

  if (slim) {
    let prompt = `${PROMPT_CORE}

${SLIM_GUARDRAILS_AND_OUTPUT}`;
    if (bookAct) {
      prompt += bookLockBlock(bookAct);
    }
    return prompt;
  }

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

${LEGACY_GUARDRAILS_AND_OUTPUT}`;
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
    ? `System Notice: The end-user has pre-selected the following statute filters: "${bookTitle}". Restrict your analysis exclusively to this domain.\n\n`
    : "";

  const dafaInstruction = useSlimNormalizePrompt()
    ? "matching_dafa_names (1–3 proposed दफा as \"दफा <संख्या>. <शीर्षक>\" — prefer 1 when one दफा fully answers, 2 when offense + सजाय needed), exact_dafa_guess (1–3 Arabic integers matching your proposed names), and excluded_dafa_guess (Arabic integers for look-alike trap sections to penalize, or [])"
    : "matching_dafa_names (2–3 verbatim taxonomy lines when applicable), exact_dafa_guess (2 Arabic integers from your top 2 matching names), and excluded_dafa_guess (Arabic integers for look-alike trap sections to penalize, or [])";

  return `${bookLine}Evaluate the user query below. Provide the full JSON object including legal_analysis_workspace, optimized_query, search_keywords, act, ${dafaInstruction}. Use null for matching_dafa_names and exact_dafa_guess only if no specific दफा applies.

User Input Transaction String:
"${question}"`;
}
