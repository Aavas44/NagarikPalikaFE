/**
 * Law RAG benchmark runner — 50 questions across indexed books.
 *
 * Usage:
 *   npm run benchmark
 *   npx tsx scripts/law-rag-benchmark.ts --limit 5
 *   npx tsx scripts/law-rag-benchmark.ts --category title-quote
 *   npx tsx scripts/law-rag-benchmark.ts --id tq-bal-vivah
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  BENCHMARK_CASES,
  type BenchmarkCase,
  type BenchmarkCategory,
} from "./law-rag-benchmark-cases";

config({ path: ".env.local" });

const BASE_URL = process.env.HANDYLAW_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "benchmark");

type SsePayload = {
  type: string;
  token?: string;
  sources?: { filename: string }[];
  retrievalMode?: string;
  chatMode?: string;
  originalQuery?: string;
  queryUsed?: string;
  translated?: boolean;
};

type CaseResult = {
  id: string;
  category: BenchmarkCategory;
  message: string;
  book: string;
  answerMode: string;
  passed: boolean;
  failures: string[];
  fixArea?: string;
  fixHint?: string;
  answerPreview: string;
  sources: string[];
  chatMode?: string;
  retrievalMode?: string;
  queryUsed?: string;
  translated?: boolean;
  durationMs: number;
};

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function fetchAnswer(
  message: string,
  book: string,
  answerMode: "quote" | "advocate"
) {
  const res = await fetch(`${BASE_URL}/api/sajilokanun/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, book, answerMode }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.text();
  let answer = "";
  let meta: SsePayload | null = null;
  let tail: SsePayload | null = null;

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const json = JSON.parse(payload) as SsePayload;
    if (json.type === "query_meta") meta = json;
    if (json.type === "token") answer += json.token ?? "";
    if (json.type === "sources") tail = json;
  }

  return { answer, meta, tail };
}

function sourceMatches(filename: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") return filename.includes(pattern);
  return pattern.test(filename);
}

function runAssertions(
  testCase: BenchmarkCase,
  answer: string,
  tail: SsePayload | null,
  meta: SsePayload | null
): string[] {
  const failures: string[] = [];
  const { expect } = testCase;

  if (expect.chatMode && tail?.chatMode !== expect.chatMode) {
    failures.push(`chatMode: expected ${expect.chatMode}, got ${tail?.chatMode ?? "none"}`);
  }

  if (expect.retrievalMode && tail?.retrievalMode !== expect.retrievalMode) {
    failures.push(
      `retrievalMode: expected ${expect.retrievalMode}, got ${tail?.retrievalMode ?? "none"}`
    );
  }

  if (expect.minSources !== undefined) {
    const count = tail?.sources?.length ?? 0;
    if (count < expect.minSources) {
      failures.push(`sources: expected >= ${expect.minSources}, got ${count}`);
    }
  }

  if (expect.sourceBook) {
    const sources = tail?.sources ?? [];
    if (sources.length === 0) {
      failures.push("sources: none returned");
    } else {
      const bad = sources.filter((s) => !sourceMatches(s.filename, expect.sourceBook!));
      if (bad.length > 0) {
        failures.push(
          `sources: expected all from ${String(expect.sourceBook)}, got: ${bad.map((s) => s.filename).join(", ")}`
        );
      }
    }
  }

  for (const re of expect.mustMatch ?? []) {
    if (!re.test(answer)) {
      failures.push(`mustMatch failed: ${re}`);
    }
  }

  for (const re of expect.mustNotMatch ?? []) {
    if (re.test(answer)) {
      failures.push(`mustNotMatch failed: ${re}`);
    }
  }

  return failures;
}

function filterCases(): BenchmarkCase[] {
  const id = getArg("id");
  const category = getArg("category") as BenchmarkCategory | null;
  const limit = getArg("limit") ? Number(getArg("limit")) : null;

  let cases = [...BENCHMARK_CASES];
  if (id) cases = cases.filter((c) => c.id === id);
  if (category) cases = cases.filter((c) => c.category === category);
  if (limit !== null && !Number.isNaN(limit)) cases = cases.slice(0, limit);
  return cases;
}

function buildFixesMarkdown(results: CaseResult[], startedAt: string): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const byCategory = new Map<string, CaseResult[]>();

  for (const r of results) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  const lines: string[] = [
    "# Law RAG Benchmark — Required Fixes",
    "",
    `Generated: ${startedAt}`,
    `Results: **${passed}/${results.length} passed** (${failed.length} failed)`,
    "",
    "Use this file after testing to prioritize retrieval, indexing, formatting, LLM, and routing fixes.",
    "",
    "## Summary by category",
    "",
    "| Category | Pass | Fail |",
    "|----------|------|------|",
  ];

  for (const [cat, catResults] of byCategory) {
    const catPass = catResults.filter((r) => r.passed).length;
    lines.push(`| ${cat} | ${catPass} | ${catResults.length - catPass} |`);
  }

  lines.push("", "## Summary by fix area", "");
  const byFixArea = new Map<string, CaseResult[]>();
  for (const r of failed) {
    const area = r.fixArea ?? "unspecified";
    const list = byFixArea.get(area) ?? [];
    list.push(r);
    byFixArea.set(area, list);
  }

  if (failed.length === 0) {
    lines.push("_No failures — all cases passed._");
  } else {
    for (const [area, areaFails] of [...byFixArea.entries()].sort()) {
      lines.push(`### ${area} (${areaFails.length})`, "");
      for (const r of areaFails) {
        lines.push(`- **${r.id}** — ${r.message}`);
        if (r.fixHint) lines.push(`  - Hint: ${r.fixHint}`);
        for (const f of r.failures) lines.push(`  - ${f}`);
        lines.push(`  - Preview: ${r.answerPreview}`);
        lines.push("");
      }
    }
  }

  lines.push("## Failed cases (detail)", "");
  if (failed.length === 0) {
    lines.push("_None._");
  } else {
    for (const r of failed) {
      lines.push(`### ${r.id} [FAIL]`, "");
      lines.push(`- **Category:** ${r.category}`);
      lines.push(`- **Query:** ${r.message}`);
      lines.push(`- **Book:** ${r.book} | **Mode:** ${r.answerMode}`);
      if (r.fixArea) lines.push(`- **Fix area:** ${r.fixArea}`);
      if (r.fixHint) lines.push(`- **Suggested fix:** ${r.fixHint}`);
      lines.push(`- **chatMode:** ${r.chatMode ?? "—"} | **retrievalMode:** ${r.retrievalMode ?? "—"}`);
      if (r.queryUsed) lines.push(`- **queryUsed:** ${r.queryUsed} (translated: ${r.translated})`);
      lines.push(`- **Sources:** ${r.sources.join("; ") || "none"}`);
      lines.push("- **Failures:**");
      for (const f of r.failures) lines.push(`  - ${f}`);
      lines.push("- **Answer preview:**");
      lines.push("```");
      lines.push(r.answerPreview);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## Passed cases", "");
  const passList = results.filter((r) => r.passed);
  for (const r of passList) {
    lines.push(`- ${r.id} (${r.category})`);
  }

  return lines.join("\n");
}

async function main() {
  const cases = filterCases();
  if (cases.length === 0) {
    console.error("No benchmark cases matched filters.");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const results: CaseResult[] = [];

  console.log(`Law RAG benchmark — ${cases.length} case(s) @ ${BASE_URL}\n`);

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const label = `[${i + 1}/${cases.length}] ${testCase.id}`;
    process.stdout.write(`${label} … `);

    const t0 = Date.now();
    try {
      const { answer, meta, tail } = await fetchAnswer(
        testCase.message,
        testCase.book,
        testCase.answerMode
      );
      const failures = runAssertions(testCase, answer, tail, meta);
      const passed = failures.length === 0;
      const result: CaseResult = {
        id: testCase.id,
        category: testCase.category,
        message: testCase.message,
        book: testCase.book,
        answerMode: testCase.answerMode,
        passed,
        failures,
        fixArea: testCase.fixArea,
        fixHint: testCase.fixHint,
        answerPreview: answer.slice(0, 800),
        sources: (tail?.sources ?? []).map((s) => s.filename),
        chatMode: tail?.chatMode,
        retrievalMode: tail?.retrievalMode,
        queryUsed: meta?.queryUsed,
        translated: meta?.translated,
        durationMs: Date.now() - t0,
      };
      results.push(result);
      console.log(passed ? "PASS" : `FAIL (${failures.length})`);
      if (!passed && hasFlag("verbose")) {
        for (const f of failures) console.log(`  - ${f}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({
        id: testCase.id,
        category: testCase.category,
        message: testCase.message,
        book: testCase.book,
        answerMode: testCase.answerMode,
        passed: false,
        failures: [`runtime error: ${msg}`],
        fixArea: testCase.fixArea,
        fixHint: testCase.fixHint,
        answerPreview: "",
        sources: [],
        durationMs: Date.now() - t0,
      });
      console.log(`ERROR: ${msg}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const jsonPath = join(OUT_DIR, "law-rag-results.json");
  const fixesPath = join(OUT_DIR, "law-rag-fixes.md");

  writeFileSync(
    jsonPath,
    JSON.stringify({ startedAt, baseUrl: BASE_URL, passed, total: results.length, results }, null, 2)
  );
  writeFileSync(fixesPath, buildFixesMarkdown(results, startedAt));

  console.log(`\n${passed}/${results.length} passed`);
  console.log(`Results: ${jsonPath}`);
  console.log(`Fixes:   ${fixesPath}`);

  if (passed < results.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
