/**
 * Integration check: same query twice → monolithic normalize + prompt cache hit on run 2.
 * Run: cd frontend && npx tsx scripts/assert-normalize-cache.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { preprocessLegalQueryWithGemini } from "../src/lib/sajilokanun/query-preprocess-gemini.ts";
import { normalizeSemanticCacheKey } from "../src/lib/sajilokanun/query-normalize-prompt.ts";
import {
  setActiveUsageCollector,
  UsageCollector,
  type TokenUsageEntry,
} from "../src/lib/sajilokanun/token-usage.ts";

const QUERY = "नेपालमा बहुविवाह सम्बन्धी कानून के हो?";

type RunMetrics = {
  run: number;
  operation: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  openAiCachedTokens: number;
  geminiCachedContentTokens: number;
  promptCacheKey: string | null;
};

const runs: RunMetrics[] = [];
const origLog = console.log;

console.log = (...args: unknown[]) => {
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");

  const stash = (globalThis as { __normalizeRun?: Partial<RunMetrics> }).__normalizeRun ?? {};

  if (line.includes("[HandyLaw query preprocess openai]")) {
    try {
      const m = line.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as {
          openAiCachedTokens?: number;
          promptCacheKey?: string;
        };
        stash.openAiCachedTokens = j.openAiCachedTokens ?? 0;
        stash.promptCacheKey = j.promptCacheKey ?? null;
      }
    } catch {
      // ignore
    }
  }

  if (line.includes("[HandyLaw query preprocess gemini]")) {
    try {
      const m = line.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as {
          cachedTokenCount?: number;
        };
        stash.geminiCachedContentTokens = j.cachedTokenCount ?? 0;
      }
    } catch {
      // ignore
    }
  }

  (globalThis as { __normalizeRun?: Partial<RunMetrics> }).__normalizeRun = stash;
  origLog(...args);
};

function entryFromCollector(entry: TokenUsageEntry, run: number, stash: Partial<RunMetrics>): RunMetrics {
  return {
    run,
    operation: entry.operation,
    provider: entry.provider,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    totalTokens: entry.totalTokens,
    openAiCachedTokens: stash.openAiCachedTokens ?? 0,
    geminiCachedContentTokens: stash.geminiCachedContentTokens ?? 0,
    promptCacheKey: stash.promptCacheKey ?? null,
  };
}

async function runOnce(run: number): Promise<RunMetrics> {
  (globalThis as { __normalizeRun?: Partial<RunMetrics> }).__normalizeRun = {};
  const collector = new UsageCollector();
  setActiveUsageCollector(collector);

  try {
    const raw = await preprocessLegalQueryWithGemini({
      query: QUERY,
      needsTranslation: true,
      vocabularyHints: [],
      bookScope: "auto",
    });
    const parsed = JSON.parse(raw) as {
      matching_dafa_names?: string[] | null;
      exact_dafa_guess?: number[] | null;
    };
    origLog(
      `[run ${run}] dafa guess:`,
      parsed.exact_dafa_guess,
      "names:",
      parsed.matching_dafa_names?.slice(0, 2)
    );
  } finally {
    setActiveUsageCollector(null);
  }

  const entries = collector.getEntries();
  const normalizeEntry = entries.find((e) => e.operation === "normalize");
  if (!normalizeEntry) {
    throw new Error(`run ${run}: expected normalize usage entry, got: ${entries.map((e) => e.operation).join(", ") || "none"}`);
  }

  const stash = (globalThis as { __normalizeRun?: Partial<RunMetrics> }).__normalizeRun ?? {};
  return entryFromCollector(normalizeEntry, run, stash);
}

const cacheKey = normalizeSemanticCacheKey({ bookScope: "auto" });

origLog("=== Monolithic normalize cache test ===\n");
origLog("query:", QUERY);
origLog("cacheKey:", cacheKey, "\n");

for (const run of [1, 2]) {
  origLog(`--- run ${run} ---`);
  const metrics = await runOnce(run);
  runs.push(metrics);
  origLog(JSON.stringify(metrics, null, 2), "\n");
}

const [run1, run2] = runs;

const cacheHit =
  run2.openAiCachedTokens > 0 || run2.geminiCachedContentTokens > 0;

const assertions: { name: string; pass: boolean; detail: string }[] = [
  {
    name: "run1_operation_normalize",
    pass: run1.operation === "normalize",
    detail: `operation=${run1.operation}`,
  },
  {
    name: "run2_operation_normalize",
    pass: run2.operation === "normalize",
    detail: `operation=${run2.operation}`,
  },
  {
    name: "no_two_step_ops",
    pass: run1.operation !== "normalize_route" && run1.operation !== "normalize_dafa",
    detail: "monolithic only",
  },
  {
    name: "run1_large_prompt",
    pass: run1.promptTokens >= 5000,
    detail: `promptTokens=${run1.promptTokens}`,
  },
  {
    name: "same_prompt_cache_key",
    pass: Boolean(run1.promptCacheKey) && run1.promptCacheKey === run2.promptCacheKey,
    detail: `${run1.promptCacheKey} === ${run2.promptCacheKey}`,
  },
  {
    name: "run2_cache_hit",
    pass: cacheHit,
    detail: `openAiCached=${run2.openAiCachedTokens}, geminiCached=${run2.geminiCachedContentTokens}`,
  },
  {
    name: "run2_not_more_expensive_than_run1",
    pass: run2.totalTokens <= run1.totalTokens,
    detail: `run1=${run1.totalTokens} run2=${run2.totalTokens}`,
  },
];

origLog("=== ASSERTIONS ===\n");
let allPass = true;
for (const a of assertions) {
  const status = a.pass ? "PASS" : "FAIL";
  if (!a.pass) allPass = false;
  origLog(`${status}  ${a.name}: ${a.detail}`);
}

origLog(`\n=== SUMMARY: ${allPass ? "ALL PASSED" : "SOME FAILED"} ===`);
process.exit(allPass ? 0 : 1);
