/**
 * Integration check: two different legal topics → different cache keys & sections.
 * Run: cd frontend && npx tsx scripts/assert-advocate-cache.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { buildAdvocatePromptCacheKey } from "../src/lib/sajilokanun/advocate-chat-cache.ts";
import { streamAnswer } from "../src/lib/sajilokanun/rag.ts";
import type { MatchedChunk } from "../src/lib/sajilokanun/supabase.ts";

const CASES = [
  {
    label: "polygamy",
    query: "नेपालमा बहुविवाह सम्बन्धी कानून के हो?",
    bookScope: "auto" as const,
  },
  {
    label: "arson",
    query: "कसैको घरमा आगजनी गरेमा कस्तो सजाय हुनेछ?",
    bookScope: "auto" as const,
  },
];

type RunResult = {
  label: string;
  run: number;
  query: string;
  sections: string[];
  chunkIds: string[];
  cacheKey: string;
  openAiCachedTokens: number;
  promptCacheKeyLogged: string | null;
};

const captured: RunResult[] = [];
const origLog = console.log;

console.log = (...args: unknown[]) => {
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  if (line.includes("[HandyLaw token usage]") || line.includes("query preprocess openai")) {
    try {
      const m = line.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as {
          cachedTokens?: number;
          openAiCachedTokens?: number;
          promptCacheKey?: string;
          operation?: string;
        };
        if (j.operation === "narrative" && j.cachedTokens != null) {
          (globalThis as { __lastNarrativeCached?: number }).__lastNarrativeCached =
            j.cachedTokens;
        }
        if (j.openAiCachedTokens != null) {
          (globalThis as { __lastNarrativeCached?: number }).__lastNarrativeCached =
            j.openAiCachedTokens;
        }
        if (j.promptCacheKey) {
          (globalThis as { __lastPromptCacheKey?: string }).__lastPromptCacheKey =
            j.promptCacheKey;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  origLog(...args);
};

function sectionRoots(chunks: MatchedChunk[]): string[] {
  return [
    ...new Set(
      chunks.map(
        (c) => `${c.filename.split("/").pop()?.slice(0, 20) ?? c.filename}|dafa-${c.section_label?.split(".")[0] ?? "?"}`
      )
    ),
  ].sort();
}

async function runCase(
  label: string,
  query: string,
  bookScope: "auto",
  run: number
): Promise<RunResult> {
  (globalThis as { __lastNarrativeCached?: number }).__lastNarrativeCached = 0;
  (globalThis as { __lastPromptCacheKey?: string }).__lastPromptCacheKey = null;

  const result = await streamAnswer(query, {
    answerMode: "advocate",
    originalQuestion: query,
    bookScope,
  });

  // Drain stream (advocate returns pre-composed verbatim stream)
  for await (const _ of result.stream) {
    // consume
  }

  const sources = result.sources ?? [];
  const cacheKey = buildAdvocatePromptCacheKey(sources, bookScope, "advocate");

  return {
    label,
    run,
    query,
    sections: sectionRoots(sources),
    chunkIds: sources.map((c) => c.id).sort(),
    cacheKey,
    openAiCachedTokens:
      (globalThis as { __lastNarrativeCached?: number }).__lastNarrativeCached ?? 0,
    promptCacheKeyLogged:
      (globalThis as { __lastPromptCacheKey?: string }).__lastPromptCacheKey ?? null,
  };
}

console.log("=== Advocate cache integration test ===\n");

for (const testCase of CASES) {
  for (const run of [1, 2]) {
    origLog(`\n--- ${testCase.label} run ${run} ---`);
    const row = await runCase(testCase.label, testCase.query, testCase.bookScope, run);
    captured.push(row);
    origLog(
      JSON.stringify(
        {
          sections: row.sections,
          cacheKey: row.cacheKey,
          openAiCachedTokens: row.openAiCachedTokens,
          chunkCount: row.chunkIds.length,
        },
        null,
        2
      )
    );
  }
}

const poly1 = captured.find((r) => r.label === "polygamy" && r.run === 1)!;
const poly2 = captured.find((r) => r.label === "polygamy" && r.run === 2)!;
const arson1 = captured.find((r) => r.label === "arson" && r.run === 1)!;
const arson2 = captured.find((r) => r.label === "arson" && r.run === 2)!;

const assertions: { name: string; pass: boolean; detail: string }[] = [
  {
    name: "different_topics_different_sections",
    pass:
      poly1.sections.join() !== arson1.sections.join() ||
      poly1.cacheKey !== arson1.cacheKey,
    detail: `polygamy: [${poly1.sections.join(", ")}] vs arson: [${arson1.sections.join(", ")}]`,
  },
  {
    name: "different_topics_different_cache_keys",
    pass: poly1.cacheKey !== arson1.cacheKey,
    detail: `${poly1.cacheKey} vs ${arson1.cacheKey}`,
  },
  {
    name: "same_topic_same_cache_key_run1_vs_run2",
    pass: poly1.cacheKey === poly2.cacheKey,
    detail: `${poly1.cacheKey} === ${poly2.cacheKey}`,
  },
  {
    name: "arson_same_cache_key_run1_vs_run2",
    pass: arson1.cacheKey === arson2.cacheKey,
    detail: `${arson1.cacheKey} === ${arson2.cacheKey}`,
  },
  {
    name: "polygamy_run2_cache_hit",
    pass: poly2.openAiCachedTokens > 0,
    detail: `openAiCachedTokens=${poly2.openAiCachedTokens} on 2nd polygamy run`,
  },
  {
    name: "arson_run2_cache_hit",
    pass: arson2.openAiCachedTokens > 0,
    detail: `openAiCachedTokens=${arson2.openAiCachedTokens} on 2nd arson run`,
  },
  {
    name: "cross_topic_no_false_cache_share",
    pass: poly1.cacheKey !== arson1.cacheKey,
    detail: "distinct keys prevent cross-topic cache bleed",
  },
];

origLog("\n=== ASSERTIONS ===\n");
let allPass = true;
for (const a of assertions) {
  const status = a.pass ? "PASS" : "FAIL";
  if (!a.pass) allPass = false;
  origLog(`${status}  ${a.name}: ${a.detail}`);
}

origLog(`\n=== SUMMARY: ${allPass ? "ALL PASSED" : "SOME FAILED"} ===`);
process.exit(allPass ? 0 : 1);
