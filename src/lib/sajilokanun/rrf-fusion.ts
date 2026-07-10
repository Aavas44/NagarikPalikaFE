import type { MatchedChunk } from "./supabase";

export type RrfFusionMeta = {
  vectorRank?: number;
  keywordRank?: number;
  rrfScore: number;
};

export type MatchedChunkWithFusion = MatchedChunk & {
  fusion?: RrfFusionMeta;
};

export function getRrfK(): number {
  const parsed = Number(process.env.RRF_K ?? 60);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function getHybridCandidateMultiplier(): number {
  const parsed = Number(process.env.HYBRID_CANDIDATE_MULTIPLIER ?? 3);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 3;
}

function parseWeight(envKey: string, fallback: number): number {
  const parsed = Number(process.env[envKey] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Default [vector, keyword] weights for auto hybrid retrieveChunks RRF. */
export function getHybridFusionWeights(): [number, number] {
  return [
    parseWeight("HYBRID_VECTOR_WEIGHT", 0.4),
    parseWeight("HYBRID_KEYWORD_WEIGHT", 0.6),
  ];
}

/** [vector, keyword, title] weights for within-chapter hierarchical RRF. */
export function getChapterFusionWeights(): [number, number, number] {
  return [
    parseWeight("CHAPTER_VECTOR_WEIGHT", 0.4),
    parseWeight("CHAPTER_KEYWORD_WEIGHT", 0.6),
    parseWeight("CHAPTER_TITLE_WEIGHT", 0.5),
  ];
}

/** Reciprocal Rank Fusion: score(doc) = Σ weight_i / (k + rank_i). Ranks are 1-based. */
export function fuseRankedListsRRF(
  lists: MatchedChunk[][],
  opts?: { k?: number; weights?: number[]; listNames?: string[] }
): MatchedChunkWithFusion[] {
  const k = opts?.k ?? getRrfK();
  const weights = opts?.weights ?? lists.map(() => 1);
  const listNames = opts?.listNames ?? lists.map((_, i) => `list${i}`);

  const scores = new Map<string, number>();
  const chunks = new Map<string, MatchedChunk>();
  const rankMeta = new Map<string, RrfFusionMeta>();

  for (let listIdx = 0; listIdx < lists.length; listIdx++) {
    const list = lists[listIdx];
    const weight = weights[listIdx] ?? 1;
    const name = listNames[listIdx] ?? `list${listIdx}`;

    for (let idx = 0; idx < list.length; idx++) {
      const chunk = list[idx];
      const rank = idx + 1;
      scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + weight / (k + rank));

      const existing = chunks.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        chunks.set(chunk.id, chunk);
      }

      const meta = rankMeta.get(chunk.id) ?? { rrfScore: 0 };
      if (name === "vector") meta.vectorRank = rank;
      else if (name === "keyword") meta.keywordRank = rank;
      rankMeta.set(chunk.id, meta);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, rrfScore]) => {
      const chunk = chunks.get(id)!;
      const fusion: RrfFusionMeta = {
        ...(rankMeta.get(id) ?? {}),
        rrfScore,
      };
      return {
        ...chunk,
        similarity: rrfScore,
        fusion,
      };
    });
}

/** Legacy merge used before RRF — kept for tests and comparison. */
export function dedupeByBestRawScore(chunks: MatchedChunk[]): MatchedChunk[] {
  const byId = new Map<string, MatchedChunk>();
  for (const chunk of chunks) {
    const existing = byId.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      byId.set(chunk.id, chunk);
    }
  }
  return [...byId.values()].sort((a, b) => b.similarity - a.similarity);
}
