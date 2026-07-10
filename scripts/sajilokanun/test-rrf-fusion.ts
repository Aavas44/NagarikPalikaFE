/**
 * Unit tests for Reciprocal Rank Fusion.
 * Run: npx tsx scripts/test-rrf-fusion.ts
 */
import type { MatchedChunk } from "../../src/lib/sajilokanun/supabase";
import {
  dedupeByBestRawScore,
  fuseRankedListsRRF,
} from "../../src/lib/sajilokanun/rrf-fusion";

function chunk(id: string, similarity: number): MatchedChunk {
  return {
    id,
    content: `content-${id}`,
    filename: "test.txt",
    page_number: 1,
    section_label: id,
    chapter: null,
    section_title: null,
    subsection: null,
    similarity,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// B is keyword #1 and vector #2 — should beat A (vector #1, keyword #3)
// and D (keyword-only #2 with inflated raw score 1.0).
const vectorList = [chunk("A", 0.92), chunk("B", 0.88), chunk("C", 0.85)];
const keywordList = [chunk("B", 0.95), chunk("D", 1.0), chunk("A", 0.5)];

const rawMerged = dedupeByBestRawScore([...vectorList, ...keywordList]);
assert(
  rawMerged[0].id === "D",
  `raw merge should pick D (sim 1.0), got ${rawMerged[0].id}`
);

const rrfMerged = fuseRankedListsRRF([vectorList, keywordList], {
  listNames: ["vector", "keyword"],
  k: 60,
});
assert(
  rrfMerged[0].id === "B",
  `RRF should pick B (strong in both lists), got ${rrfMerged[0].id}`
);
assert(
  rrfMerged[0].fusion?.vectorRank === 2 && rrfMerged[0].fusion?.keywordRank === 1,
  "B should have vectorRank=2 and keywordRank=1"
);

// Single-list passthrough behavior: order preserved by rank
const single = fuseRankedListsRRF([vectorList], { listNames: ["vector"], k: 60 });
assert(single[0].id === "A", "single list RRF should rank A first");

// Empty lists
assert(fuseRankedListsRRF([]).length === 0, "empty input returns empty");

console.log("All RRF fusion tests passed.");
