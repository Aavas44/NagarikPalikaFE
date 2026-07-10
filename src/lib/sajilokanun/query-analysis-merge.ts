import { normalizeActToBookScope } from "./lawbooks";
import type { ChapterHint, QueryAnalysis, SectionHint } from "./query-analysis";

function dedupeSectionHints(hints: SectionHint[]): SectionHint[] {
  const seen = new Set<string>();
  const out: SectionHint[] = [];
  for (const hint of hints) {
    const key = `${hint.act}:${hint.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hint);
  }
  return out;
}

function dedupeChapterHints(hints: ChapterHint[]): ChapterHint[] {
  const seen = new Set<string>();
  const out: ChapterHint[] = [];
  for (const hint of hints) {
    const key = `${hint.act}:${hint.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hint);
  }
  return out;
}

/** Merge LLM analysis with optional regex/heuristic hints (heuristics supplement, never replace). */
export function mergeQueryAnalysis(
  llm: QueryAnalysis,
  heuristic: QueryAnalysis | null
): QueryAnalysis {
  if (!heuristic) return llm;

  return {
    ...llm,
    intent: llm.intent || heuristic.intent,
    legalIssues: [
      ...new Set([...heuristic.legalIssues, ...llm.legalIssues]),
    ].slice(0, 8),
    factsFromQuestion: llm.factsFromQuestion.length
      ? llm.factsFromQuestion
      : heuristic.factsFromQuestion,
    retrievalQueries: [
      ...new Set([
        ...heuristic.retrievalQueries,
        ...llm.retrievalQueries,
      ]),
    ].slice(0, 4),
    sectionHints: (() => {
      const merged = dedupeSectionHints([
        ...heuristic.sectionHints,
        ...llm.sectionHints,
      ]);
      if (heuristic.sectionHints.length > 0 && heuristic.preferredAct) {
        const scope = normalizeActToBookScope(heuristic.preferredAct);
        if (scope) {
          return merged
            .filter((h) => normalizeActToBookScope(h.act) === scope)
            .slice(0, 6);
        }
      }
      return merged.slice(0, 6);
    })(),
    chapterHints: (() => {
      const merged = dedupeChapterHints([
        ...heuristic.chapterHints,
        ...llm.chapterHints,
      ]);
      if (heuristic.chapterHints.length > 0 && heuristic.preferredAct) {
        const scope = normalizeActToBookScope(heuristic.preferredAct);
        if (scope) {
          return merged
            .filter((h) => normalizeActToBookScope(h.act) === scope)
            .slice(0, 3);
        }
      }
      return merged.slice(0, 3);
    })(),
    titleSearchHints: [
      ...new Set([
        ...heuristic.titleSearchHints,
        ...llm.titleSearchHints,
      ]),
    ].slice(0, 4),
    preferredAct: heuristic.preferredAct || llm.preferredAct,
  };
}
