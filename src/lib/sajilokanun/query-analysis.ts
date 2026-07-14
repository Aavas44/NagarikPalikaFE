import { completeChat } from "./ai";
import { tryFastQueryAnalysis } from "./fast-query-analysis";
import { bookTitleForScope, type BookScope } from "./lawbooks";
import { mergeQueryAnalysis } from "./query-analysis-merge";

export type SectionHint = {
  section: string;
  act: string;
};

export type ChapterHint = {
  /** Chapter number — Arabic or Devanagari (e.g. "6" or "६"). */
  chapter: string;
  act: string;
  /** Optional chapter name fragment (e.g. "अदालती शुल्क"). */
  name?: string;
};

export type QueryAnalysis = {
  originalQuery: string;
  intent: string;
  legalIssues: string[];
  factsFromQuestion: string[];
  retrievalQueries: string[];
  /** LLM-suggested दफा to fetch by metadata (general routing, not regex pins). */
  sectionHints: SectionHint[];
  /** Governing परिच्छेद when the answer spans a whole chapter. */
  chapterHints: ChapterHint[];
  /** Short Nepali title phrases for provision title search. */
  titleSearchHints: string[];
  preferredAct?: string;
};

const ANALYSIS_SYSTEM = `You analyze user questions about Nepali law (Muluki Ain) for a legal retrieval system.

Return ONLY valid JSON (no markdown fences) matching this schema:
{
  "intent": "string — what the user wants to know",
  "legalIssues": ["string — legal topics/issues to research"],
  "factsFromQuestion": ["string — explicit facts stated in the question; empty array if pure law lookup"],
  "retrievalQueries": ["1 to 4 search strings in Nepali for finding relevant दफा"],
  "sectionHints": [{"section": "82", "act": "civil-procedure"}],
  "chapterHints": [{"chapter": "6", "name": "अदालती शुल्क", "act": "civil-procedure"}],
  "titleSearchHints": ["मिलापत्र अदालती शुल्क"],
  "preferredAct": "optional — civil-procedure | civil-code | criminal-code | criminal-procedure"
}

Rules for retrievalQueries:
- Use 1 query for simple lookups (e.g. a specific दफा or single term)
- Use 2–4 queries for complex/scenario questions: split substantive law, procedure, fees, deadlines, remedies, etc.
- Include formal Nepali legal terms from the statutes (e.g. अदालती शुल्क not just कोर्ट फी, मिलापत्र, प्रतिउत्तर, फिराद)
- Write all retrievalQueries in Nepali (Devanagari) only
- When book scope is "all indexed acts", search across all four Muluki books
- Set preferredAct to the act most likely to contain the answer

Rules for sectionHints (critical for scenario questions):
- Suggest up to 6 दफा numbers you believe DIRECTLY govern the answer, using Arabic numerals in "section" (e.g. "82", "101")
- "act" must be one of: civil-procedure, civil-code, criminal-code, criminal-procedure
- Only include hints you are confident about from Muluki Ain structure
- For court fee + settlement → civil-procedure 82, 248; for written reply deadline → 101; etc.
- For polygamy/बहुविवाह → criminal-code 175; incest/हाडनाता → 226; sexual harassment → 224
- For unjust enrichment / mistaken payment / अनुचित सम्वृद्धि → civil-code 664–667 (not 660)
- For custody/पक्राउ investigation → criminal-procedure 14; complaint refusal → 5

Rules for chapterHints (when the answer lives inside one परिच्छेद):
- Suggest up to 3 governing chapters (primary chapter first; add another only if a hinted दफा is in a different परिच्छेद, e.g. refund deadline)
- "chapter" is the chapter number (Arabic or Devanagari); "name" is a short Nepali name fragment from the statute
- Example: court fee / कोर्ट फी / अदालती शुल्क → {"chapter": "6", "name": "अदालती शुल्क", "act": "civil-procedure"}
- Example: written reply / प्रतिउत्तर → {"chapter": "9", "name": "प्रतिउत्तर", "act": "civil-procedure"}

Rules for titleSearchHints:
- Up to 3 short Nepali phrases matching दफा titles (e.g. "म्याद दिनु पर्ने", "मुद्दा मिलापत्र")

- Do not invent facts not in the question`;

function buildAnalysisUserPrompt(question: string, bookScope: BookScope): string {
  const bookHint = bookTitleForScope(bookScope);
  return `User question:
${question}

${bookHint ? `User selected book scope: ${bookHint}` : "Book scope: all indexed acts (auto) — generate retrieval queries that may match any Muluki Ain book; set preferredAct to the most relevant act."}

Produce JSON analysis for retrieval.`;
}

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

function parseSectionHints(raw: unknown): SectionHint[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionHint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const section = String((item as SectionHint).section ?? "").trim();
    const act = String((item as SectionHint).act ?? "").trim();
    if (!section || !act) continue;
    const normalized = section.replace(/[^\d.]/g, "");
    if (!normalized) continue;
    out.push({ section: normalized, act });
  }
  return out.slice(0, 6);
}

function parseChapterHints(raw: unknown): ChapterHint[] {
  if (!Array.isArray(raw)) return [];
  const out: ChapterHint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const chapter = String((item as ChapterHint).chapter ?? "").trim();
    const act = String((item as ChapterHint).act ?? "").trim();
    const name =
      typeof (item as ChapterHint).name === "string"
        ? (item as ChapterHint).name!.trim()
        : undefined;
    if (!chapter || !act) continue;
    const normalized = chapter.replace(/[^\d०-९]/g, "");
    if (!normalized) continue;
    out.push({ chapter: normalized, act, ...(name ? { name } : {}) });
  }
  return out.slice(0, 3);
}

function parseAnalysis(raw: string, question: string): QueryAnalysis {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<QueryAnalysis>;
    const retrievalQueries = Array.isArray(parsed.retrievalQueries)
      ? parsed.retrievalQueries
          .map((q) => (typeof q === "string" ? q.trim() : ""))
          .filter(Boolean)
      : [];

    return {
      originalQuery: question,
      intent: typeof parsed.intent === "string" ? parsed.intent.trim() : question,
      legalIssues: Array.isArray(parsed.legalIssues)
        ? parsed.legalIssues.filter((x): x is string => typeof x === "string")
        : [],
      factsFromQuestion: Array.isArray(parsed.factsFromQuestion)
        ? parsed.factsFromQuestion.filter((x): x is string => typeof x === "string")
        : [],
      retrievalQueries:
        retrievalQueries.length > 0 ? retrievalQueries.slice(0, 4) : [question],
      sectionHints: parseSectionHints(parsed.sectionHints),
      chapterHints: parseChapterHints(parsed.chapterHints),
      titleSearchHints: Array.isArray(parsed.titleSearchHints)
        ? parsed.titleSearchHints
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [],
      preferredAct:
        typeof parsed.preferredAct === "string"
          ? parsed.preferredAct.trim()
          : undefined,
    };
  } catch {
    return {
      originalQuery: question,
      intent: question,
      legalIssues: [],
      factsFromQuestion: [],
      retrievalQueries: [question],
      sectionHints: [],
      chapterHints: [],
      titleSearchHints: [],
    };
  }
}

export async function analyzeQuery(
  question: string,
  bookScope: BookScope = "auto"
): Promise<QueryAnalysis> {
  const heuristic = tryFastQueryAnalysis(question, bookScope);

  const raw = await completeChat(
    ANALYSIS_SYSTEM,
    buildAnalysisUserPrompt(question, bookScope),
    undefined,
    "analysis"
  );
  const llm = parseAnalysis(raw, question);
  const analysis = mergeQueryAnalysis(llm, heuristic);

  console.log(
    "[HandyLaw query analysis]",
    JSON.stringify(
      {
        heuristicMerged: Boolean(heuristic),
        sectionHints: analysis.sectionHints,
        preferredAct: analysis.preferredAct,
        titleSearchHints: analysis.titleSearchHints,
        intent: analysis.intent,
      },
      null,
      2
    )
  );
  return analysis;
}
