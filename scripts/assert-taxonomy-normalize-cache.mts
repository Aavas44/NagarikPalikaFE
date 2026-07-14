/**
 * Full taxonomy normalize (QUERY_NORMALIZE_SLIM=false) + token usage assertions.
 *
 * Phase A — preprocess twice (no result cache): Gemini context-cache hit on run 2
 * Phase B — normalize twice: in-memory result cache on run 2 (0 normalize tokens)
 *
 * Usage:
 *   cd frontend && npx tsx scripts/assert-taxonomy-normalize-cache.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.QUERY_NORMALIZE_SLIM = "false";

import { preprocessLegalQueryWithGemini } from "../src/lib/sajilokanun/query-preprocess-gemini.ts";
import {
  normalizeQueryWithGemini,
  parseGeminiResponse,
} from "../src/lib/sajilokanun/query-translate.ts";
import {
  buildNormalizeSystemInstruction,
  normalizeSemanticCacheKey,
  useSlimNormalizePrompt,
  NORMALIZE_PROMPT_VERSION,
} from "../src/lib/sajilokanun/query-normalize-prompt.ts";
import { formatDafaTaxonomyForPrompt } from "../src/lib/sajilokanun/dafa-name-taxonomy.ts";
import {
  estimateBillableTokens,
  setActiveUsageCollector,
  UsageCollector,
  type TokenUsageEntry,
} from "../src/lib/sajilokanun/token-usage.ts";

const QUERIES = [
  {
    label: "public_property_damage",
    query: "सार्वजनिक सम्पत्तिमा क्षति पुर्‍याउँदाके सजाय हुन्छ?",
    expectDafaRoots: [73],
  },
  {
    label: "polygamy",
    query: "नेपालमा बहुविवाह सम्बन्धी कानून के हो?",
    expectDafaRoots: [175],
  },
] as const;

type RunMetrics = {
  label: string;
  phase: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  billableTokens: number;
  geminiCachedContentTokens: number;
  openAiCachedTokens: number;
  matchingDafaNames: string[];
  exactDafaGuess: number[];
  skippedLlm?: boolean;
};

const origLog = console.log;
let logStash = { geminiCachedContentTokens: 0, openAiCachedTokens: 0 };

console.log = (...args: unknown[]) => {
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");

  if (line.includes("[HandyLaw query preprocess openai]")) {
    try {
      const m = line.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as { openAiCachedTokens?: number };
        logStash.openAiCachedTokens = j.openAiCachedTokens ?? 0;
      }
    } catch {
      // ignore
    }
  }

  if (line.includes("[HandyLaw query preprocess gemini]")) {
    try {
      const m = line.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as { cachedTokenCount?: number };
        logStash.geminiCachedContentTokens = j.cachedTokenCount ?? 0;
      }
    } catch {
      // ignore
    }
  }

  origLog(...args);
};

function resetLogStash(): void {
  logStash = { geminiCachedContentTokens: 0, openAiCachedTokens: 0 };
}

function metricsFromEntry(
  label: string,
  phase: string,
  entry: TokenUsageEntry | undefined,
  parsed: { matchingDafaNames?: string[]; exactDafaGuess?: number[] }
): RunMetrics {
  const cachedTokens =
    entry?.cachedTokens ??
    (logStash.geminiCachedContentTokens || logStash.openAiCachedTokens || 0);
  return {
    label,
    phase,
    promptTokens: entry?.promptTokens ?? 0,
    completionTokens: entry?.completionTokens ?? 0,
    totalTokens: entry?.totalTokens ?? 0,
    cachedTokens,
    billableTokens: entry
      ? estimateBillableTokens({
          promptTokens: entry.promptTokens,
          completionTokens: entry.completionTokens,
          cachedTokens: entry.cachedTokens,
        })
      : 0,
    geminiCachedContentTokens: logStash.geminiCachedContentTokens,
    openAiCachedTokens: logStash.openAiCachedTokens,
    matchingDafaNames: parsed.matchingDafaNames ?? [],
    exactDafaGuess: parsed.exactDafaGuess ?? [],
    skippedLlm: !entry || entry.totalTokens === 0,
  };
}

async function runPreprocess(
  label: string,
  phase: string,
  query: string
): Promise<RunMetrics> {
  resetLogStash();
  const collector = new UsageCollector();
  setActiveUsageCollector(collector);

  let parsed: { matchingDafaNames?: string[]; exactDafaGuess?: number[] } = {};
  try {
    const raw = await preprocessLegalQueryWithGemini({
      query,
      needsTranslation: false,
      vocabularyHints: [],
      bookScope: "auto",
    });
    const result = parseGeminiResponse(raw);
    parsed = {
      matchingDafaNames: result.metadata.matchingDafaNames,
      exactDafaGuess: result.metadata.exactDafaGuess,
    };
  } finally {
    setActiveUsageCollector(null);
  }

  const entry = collector.getEntries().find((e) => e.operation === "normalize");
  return metricsFromEntry(label, phase, entry, parsed);
}

async function runNormalize(
  label: string,
  phase: string,
  query: string
): Promise<RunMetrics> {
  resetLogStash();
  const collector = new UsageCollector();
  setActiveUsageCollector(collector);

  let parsed: { matchingDafaNames?: string[]; exactDafaGuess?: number[] } = {};
  try {
    const result = await normalizeQueryWithGemini(query, { book: undefined });
    parsed = {
      matchingDafaNames: result.metadataHint?.matchingDafaNames,
      exactDafaGuess: result.metadataHint?.exactDafaGuess,
    };
  } finally {
    setActiveUsageCollector(null);
  }

  const entry = collector.getEntries().find((e) => e.operation === "normalize");
  return metricsFromEntry(label, phase, entry, parsed);
}

async function main(): Promise<void> {
  const taxonomyChars = formatDafaTaxonomyForPrompt("auto").length;
  const systemChars = buildNormalizeSystemInstruction().length;

  origLog("=== Full taxonomy normalize + cache token test ===\n");
  origLog("promptVersion:", NORMALIZE_PROMPT_VERSION);
  origLog("slimMode:", useSlimNormalizePrompt());
  origLog("taxonomyChars:", taxonomyChars);
  origLog("systemChars:", systemChars, `(~${Math.round(systemChars / 4)} tokens)`);
  origLog("semanticCacheKey:", normalizeSemanticCacheKey({ bookScope: "auto" }));
  origLog("");

  const preprocessMetrics: RunMetrics[] = [];
  const normalizeMetrics: RunMetrics[] = [];

  origLog("=== Phase A: preprocess (prompt / context cache) ===\n");
  for (const testCase of QUERIES) {
    origLog(`--- ${testCase.label} ---`);
    const run1 = await runPreprocess(testCase.label, "preprocess_cold", testCase.query);
    preprocessMetrics.push(run1);
    origLog("preprocess run1:", JSON.stringify(run1, null, 2));

    const run2 = await runPreprocess(testCase.label, "preprocess_prompt_cache", testCase.query);
    preprocessMetrics.push(run2);
    origLog("preprocess run2:", JSON.stringify(run2, null, 2));
    origLog("");
  }

  origLog("=== Phase B: normalize (result cache) ===\n");
  for (const testCase of QUERIES) {
    origLog(`--- ${testCase.label} ---`);
    const run1 = await runNormalize(testCase.label, "normalize_cold", testCase.query);
    normalizeMetrics.push(run1);
    origLog("normalize run1:", JSON.stringify(run1, null, 2));

    const run2 = await runNormalize(testCase.label, "normalize_result_cache", testCase.query);
    normalizeMetrics.push(run2);
    origLog("normalize run2:", JSON.stringify(run2, null, 2));
    origLog("");
  }

  const [pubPre1, pubPre2, polyPre1, polyPre2] = preprocessMetrics;
  const [pubNorm1, pubNorm2, polyNorm1, polyNorm2] = normalizeMetrics;

  const assertions: { name: string; pass: boolean; detail: string }[] = [
    {
      name: "slim_mode_off",
      pass: !useSlimNormalizePrompt(),
      detail: `slim=${useSlimNormalizePrompt()}`,
    },
    {
      name: "cold_prompt_large",
      pass: pubPre1.promptTokens >= 5000,
      detail: `pub preprocess promptTokens=${pubPre1.promptTokens}`,
    },
    {
      name: "pub_preprocess_prompt_cache",
      pass:
        pubPre2.geminiCachedContentTokens > 0 ||
        pubPre2.openAiCachedTokens > 0 ||
        pubPre2.billableTokens < pubPre1.billableTokens,
      detail: `billable run1=${pubPre1.billableTokens} run2=${pubPre2.billableTokens} geminiCached=${pubPre2.geminiCachedContentTokens}`,
    },
    {
      name: "pub_result_cache_zero_tokens",
      pass: pubNorm2.skippedLlm && pubNorm2.totalTokens === 0,
      detail: `totalTokens=${pubNorm2.totalTokens} skippedLlm=${pubNorm2.skippedLlm}`,
    },
    {
      name: "poly_result_cache_zero_tokens",
      pass: polyNorm2.skippedLlm && polyNorm2.totalTokens === 0,
      detail: `totalTokens=${polyNorm2.totalTokens} skippedLlm=${polyNorm2.skippedLlm}`,
    },
    {
      name: "poly_dafa175",
      pass:
        polyPre1.exactDafaGuess.includes(175) ||
        polyNorm1.exactDafaGuess.includes(175),
      detail: `pre=${JSON.stringify(polyPre1.exactDafaGuess)} norm=${JSON.stringify(polyNorm1.exactDafaGuess)}`,
    },
    {
      name: "pub_dafa73_quality",
      pass:
        pubPre1.exactDafaGuess.includes(73) ||
        pubPre2.exactDafaGuess.includes(73) ||
        pubNorm1.exactDafaGuess.includes(73),
      detail: `pre1=${JSON.stringify(pubPre1.exactDafaGuess)} pre2=${JSON.stringify(pubPre2.exactDafaGuess)} norm1=${JSON.stringify(pubNorm1.exactDafaGuess)} (expected 73)`,
    },
  ];

  origLog("=== TOKEN SUMMARY ===\n");
  origLog(
    JSON.stringify(
      {
        preprocess: {
          public_property: { cold: pubPre1, promptCache: pubPre2 },
          polygamy: { cold: polyPre1, promptCache: polyPre2 },
        },
        normalize: {
          public_property: { cold: pubNorm1, resultCache: pubNorm2 },
          polygamy: { cold: polyNorm1, resultCache: polyNorm2 },
        },
      },
      null,
      2
    )
  );

  origLog("\n=== ASSERTIONS ===\n");
  let allPass = true;
  for (const a of assertions) {
    const status = a.pass ? "PASS" : "FAIL";
    if (!a.pass) allPass = false;
    origLog(`${status}  ${a.name}: ${a.detail}`);
  }

  origLog(`\n=== SUMMARY: ${allPass ? "ALL PASSED" : "SOME FAILED"} ===`);
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
